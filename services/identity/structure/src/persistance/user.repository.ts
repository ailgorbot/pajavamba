/**
 * Dépôt PostgreSQL des utilisateurs, avec verrouillage optimiste par version.
 *
 * Couche : moyenne (identity/structure). Règles : RI-COD-09, RI-DON-09.
 */
import type { User, UserRepository } from '@pajavamba/identity-fonctionnel';
import { toEntityId } from '@pajavamba/kernel';
import { HttpProblem, type SqlExecutor } from '@pajavamba/ops';
import { toDate, toMillis } from './sql-mapping.ts';

/** Colonnes lues pour un utilisateur (alias `u`). */
export const USER_COLUMNS = 'u.id, u.email, u.display_name, u.status, u.theme, u.password_hash, u.failed_login_count, u.last_failed_login_at, u.version';

/** Ligne d'utilisateur. */
export interface UserRow {
  readonly id: string;
  readonly email: string;
  readonly display_name: string;
  readonly status: User['status'];
  readonly theme: User['theme'];
  readonly password_hash: string | null;
  readonly failed_login_count: number;
  readonly last_failed_login_at: Date | null;
  readonly version: number;
}

/**
 * Convertit une ligne d'utilisateur.
 * @param row ligne
 * @returns utilisateur
 */
export function mapUser(row: UserRow): User {
  return {
    id: toEntityId(row.id),
    email: row.email,
    displayName: row.display_name,
    status: row.status,
    theme: row.theme,
    passwordHash: row.password_hash,
    failedLoginCount: row.failed_login_count,
    lastFailedLoginAt: toMillis(row.last_failed_login_at),
    version: row.version,
  };
}

const CONCURRENT_UPDATE = new HttpProblem({ status: 409, code: 'identity.concurrent_update', title: 'Modification concurrente', detail: 'Cet utilisateur a été modifié entre-temps. Rechargez puis réessayez.' });

/**
 * Crée le dépôt des utilisateurs.
 * @param tx transaction
 * @returns dépôt
 */
export function userRepository(tx: SqlExecutor): UserRepository {
  const findOne = async (where: string, value: string): Promise<User | undefined> => {
    const rows = await tx.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users u WHERE ${where} = $1`, [value]);
    return rows[0] === undefined ? undefined : mapUser(rows[0]);
  };
  return {
    findById: async (id) => findOne('u.id', id),
    findByEmail: async (email) => findOne('u.email', email),
    async insert(user) {
      await tx.query('INSERT INTO users (id, email, display_name, status, theme, password_hash, version) VALUES ($1, $2, $3, $4, $5, $6, $7)', [user.id, user.email, user.displayName, user.status, user.theme, user.passwordHash, user.version]);
    },
    async update(user) {
      const rows = await tx.query(
        `UPDATE users SET display_name = $2, status = $3, theme = $4, password_hash = $5, failed_login_count = $6,
           last_failed_login_at = $7, deactivated_at = CASE WHEN $3 = 'deactivated' THEN now() ELSE NULL END, version = $8
         WHERE id = $1 AND version = $8 - 1 RETURNING id`,
        [user.id, user.displayName, user.status, user.theme, user.passwordHash, user.failedLoginCount, toDate(user.lastFailedLoginAt), user.version],
      );
      if (rows.length === 0) throw CONCURRENT_UPDATE;
    },
  };
}
