/**
 * Dépôt PostgreSQL des sessions (seule l'empreinte du secret est stockée).
 *
 * Couche : moyenne (identity/structure). Règles : RI-SCR-03, RI-CNX-10.
 */
import { SESSION_ABSOLUTE_TTL_MS, SESSION_IDLE_TTL_MS, type Session, type SessionRepository } from '@pajavamba/identity-fonctionnel';
import { toEntityId } from '@pajavamba/kernel';
import type { SqlExecutor } from '@pajavamba/ops';
import { toDate, toMillis } from './sql-mapping.ts';

interface SessionRow {
  readonly id: string;
  readonly user_id: string;
  readonly current_organisation_id: string;
  readonly created_at: Date;
  readonly last_seen_at: Date;
  readonly mfa_verified_at: Date | null;
  readonly csrf_token: string;
  readonly revoked_at: Date | null;
}

const COLUMNS = 'id, user_id, current_organisation_id, created_at, last_seen_at, mfa_verified_at, csrf_token, revoked_at';

/**
 * Convertit une ligne de session.
 * @param row ligne
 * @returns session
 */
function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    userId: toEntityId(row.user_id),
    organisationId: toEntityId(row.current_organisation_id),
    createdAt: row.created_at.getTime(),
    lastSeenAt: row.last_seen_at.getTime(),
    mfaVerifiedAt: toMillis(row.mfa_verified_at),
    csrfToken: row.csrf_token,
    revokedAt: toMillis(row.revoked_at),
  };
}

/**
 * Sessions actives et révocation globale.
 * @param tx transaction
 * @returns opérations
 */
function sessionQueries(tx: SqlExecutor): Pick<SessionRepository, 'listActiveOf' | 'revokeAllOf'> {
  return {
    async listActiveOf(userId, now) {
      const rows = await tx.query<SessionRow>(
        `SELECT ${COLUMNS} FROM sessions WHERE user_id = $1 AND revoked_at IS NULL AND created_at > $2 AND last_seen_at > $3 ORDER BY last_seen_at DESC`,
        [userId, new Date(now - SESSION_ABSOLUTE_TTL_MS), new Date(now - SESSION_IDLE_TTL_MS)],
      );
      return rows.map(mapSession);
    },
    async revokeAllOf(userId, now) {
      const rows = await tx.query('UPDATE sessions SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL RETURNING id', [userId, new Date(now)]);
      return rows.length;
    },
  };
}

/**
 * Crée le dépôt des sessions.
 * @param tx transaction
 * @returns dépôt
 */
export function sessionRepository(tx: SqlExecutor): SessionRepository {
  const findOne = async (where: string, value: unknown): Promise<Session | undefined> => {
    const rows = await tx.query<SessionRow>(`SELECT ${COLUMNS} FROM sessions WHERE ${where} = $1`, [value]);
    return rows[0] === undefined ? undefined : mapSession(rows[0]);
  };
  return {
    async insert(session, secretHash) {
      await tx.query(
        `INSERT INTO sessions (id, secret_hash, user_id, current_organisation_id, csrf_token, created_at, last_seen_at, mfa_verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [session.id, secretHash, session.userId, session.organisationId, session.csrfToken, new Date(session.createdAt), new Date(session.lastSeenAt), toDate(session.mfaVerifiedAt)],
      );
    },
    findBySecretHash: async (secretHash) => findOne('secret_hash', secretHash),
    findById: async (id) => findOne('id', id),
    async update(session) {
      await tx.query('UPDATE sessions SET last_seen_at = $2, mfa_verified_at = $3, revoked_at = $4 WHERE id = $1', [session.id, new Date(session.lastSeenAt), toDate(session.mfaVerifiedAt), toDate(session.revokedAt)]);
    },
    ...sessionQueries(tx),
  };
}
