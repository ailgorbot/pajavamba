/**
 * Dépôts PostgreSQL des facteurs MFA, des clés API et des invitations.
 *
 * Couche : moyenne (identity/structure). Règles : RI-SCR-03 (empreintes), RI-SCR-05 (secret TOTP
 * chiffré AES-256-GCM avec données associées).
 */
import type { ApiKey, CredentialRepository, MfaRepository } from '@pajavamba/identity-fonctionnel';
import { toEntityId } from '@pajavamba/kernel';
import { decryptField, encryptField, type SqlExecutor } from '@pajavamba/ops';
import { toMillis } from './sql-mapping.ts';

/**
 * Crée le dépôt MFA ; le secret TOTP est chiffré au repos.
 * @param tx transaction
 * @param key clé de chiffrement des champs
 * @returns dépôt
 */
export function mfaRepository(tx: SqlExecutor, key: Buffer): MfaRepository {
  return {
    async findTotp(userId) {
      const rows = await tx.query<{ readonly secret: string; readonly confirmed: boolean }>('SELECT secret, confirmed FROM totp_factors WHERE user_id = $1', [userId]);
      const row = rows[0];
      return row === undefined ? undefined : { userId, secret: decryptField(key, row.secret, `identity.totp_factors.secret:${userId}`), confirmed: row.confirmed };
    },
    async saveTotp(factor) {
      const secret = encryptField(key, factor.secret, `identity.totp_factors.secret:${factor.userId}`);
      await tx.query(
        'INSERT INTO totp_factors (user_id, secret, confirmed) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET secret = EXCLUDED.secret, confirmed = EXCLUDED.confirmed',
        [factor.userId, secret, factor.confirmed],
      );
    },
    async replaceRecoveryCodes(userId, hashes) {
      await tx.query('DELETE FROM recovery_codes WHERE user_id = $1', [userId]);
      for (const hash of hashes) {
        await tx.query('INSERT INTO recovery_codes (user_id, code_hash) VALUES ($1, $2)', [userId, hash]);
      }
    },
  };
}

interface KeyRow {
  readonly id: string;
  readonly owner_id: string;
  readonly public_id: string;
  readonly name: string;
  readonly read_only: boolean;
  readonly created_at: Date;
  readonly last_used_at: Date | null;
  readonly revoked_at: Date | null;
  readonly secret_hash: Buffer;
}

/**
 * Convertit une ligne de clé.
 * @param row ligne
 * @returns métadonnées de la clé
 */
function mapKey(row: KeyRow): ApiKey {
  return { id: row.id, userId: toEntityId(row.owner_id), publicId: row.public_id, name: row.name, readOnly: row.read_only, createdAt: row.created_at.getTime(), lastUsedAt: toMillis(row.last_used_at), revokedAt: toMillis(row.revoked_at) };
}

const KEY_COLUMNS = 'id, owner_id, public_id, name, read_only, created_at, last_used_at, revoked_at, secret_hash';

/**
 * Invitations à usage unique.
 * @param tx transaction
 * @returns opérations
 */
function invitations(tx: SqlExecutor): Pick<CredentialRepository, 'insertInvitation' | 'consumeInvitation'> {
  return {
    async insertInvitation(invitation) {
      await tx.query('INSERT INTO invitations (code_hash, user_id, organisation_id, expires_at) VALUES ($1, $2, $3, $4)', [invitation.codeHash, invitation.userId, invitation.organisationId, new Date(invitation.expiresAt)]);
    },
    async consumeInvitation(codeHash, now) {
      const rows = await tx.query<{ readonly user_id: string; readonly organisation_id: string }>(
        'UPDATE invitations SET used_at = $2 WHERE code_hash = $1 AND used_at IS NULL AND expires_at > $2 RETURNING user_id, organisation_id',
        [codeHash, new Date(now)],
      );
      const row = rows[0];
      return row === undefined ? undefined : { userId: toEntityId(row.user_id), organisationId: toEntityId(row.organisation_id) };
    },
  };
}

/**
 * Crée le dépôt des clés et invitations.
 * @param tx transaction
 * @returns dépôt
 */
export function credentialRepository(tx: SqlExecutor): CredentialRepository {
  return {
    async findActiveKeyOf(userId) {
      const rows = await tx.query<KeyRow>(`SELECT ${KEY_COLUMNS} FROM api_keys WHERE owner_id = $1 AND revoked_at IS NULL`, [userId]);
      return rows[0] === undefined ? undefined : mapKey(rows[0]);
    },
    async findKeyByPublicId(publicId) {
      const rows = await tx.query<KeyRow>(`SELECT ${KEY_COLUMNS} FROM api_keys WHERE public_id = $1`, [publicId]);
      return rows[0] === undefined ? undefined : { ...mapKey(rows[0]), secretHash: rows[0].secret_hash };
    },
    async insertKey(key, secretHash) {
      await tx.query('INSERT INTO api_keys (id, public_id, secret_hash, owner_id, name, read_only, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [key.id, key.publicId, secretHash, key.userId, key.name, key.readOnly, new Date(key.createdAt)]);
    },
    async revokeKey(id, now) {
      await tx.query('UPDATE api_keys SET revoked_at = $2 WHERE id = $1', [id, new Date(now)]);
    },
    async revokeKeysOf(userId, now) {
      await tx.query('UPDATE api_keys SET revoked_at = $2 WHERE owner_id = $1 AND revoked_at IS NULL', [userId, new Date(now)]);
    },
    async touchKey(id, now) {
      await tx.query('UPDATE api_keys SET last_used_at = $2 WHERE id = $1', [id, new Date(now)]);
    },
    ...invitations(tx),
  };
}
