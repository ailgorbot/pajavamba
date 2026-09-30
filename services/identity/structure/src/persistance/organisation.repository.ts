/**
 * Dépôt PostgreSQL des organisations et appartenances.
 *
 * Couche : moyenne (identity/structure). Règles : RI-COD-09 (SQL paramétré), RI-DON-02 (RLS).
 */
import type { Membership, Organisation, OrganisationRepository, OrganisationRole, User } from '@pajavamba/identity-fonctionnel';
import { toEntityId } from '@pajavamba/kernel';
import type { SqlExecutor } from '@pajavamba/ops';
import { mapUser, USER_COLUMNS, type UserRow } from './user.repository.ts';

interface OrganisationRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly status: Organisation['status'];
}

interface MembershipRow {
  readonly organisation_id: string;
  readonly user_id: string;
  readonly org_role: OrganisationRole;
  readonly status: Membership['status'];
}

interface MemberRow {
  readonly org_role: OrganisationRole;
  readonly membership_status: Membership['status'];
}

/**
 * Convertit une ligne d'appartenance.
 * @param row ligne
 * @returns appartenance
 */
function mapMembership(row: MembershipRow): Membership {
  return { organisationId: toEntityId(row.organisation_id), userId: toEntityId(row.user_id), orgRole: row.org_role, status: row.status };
}

/**
 * Appartenances des utilisateurs aux organisations.
 * @param tx transaction
 * @returns opérations
 */
function memberships(tx: SqlExecutor): Pick<OrganisationRepository, 'findMembership' | 'firstActiveMembership' | 'upsertMembership' | 'listMembers'> {
  return {
    async findMembership(organisationId, userId) {
      const rows = await tx.query<MembershipRow>('SELECT organisation_id, user_id, org_role, status FROM memberships WHERE organisation_id = $1 AND user_id = $2', [organisationId, userId]);
      return rows[0] === undefined ? undefined : mapMembership(rows[0]);
    },
    async firstActiveMembership(userId) {
      const rows = await tx.query<{ readonly organisation_id: string; readonly org_role: OrganisationRole }>('SELECT organisation_id, org_role FROM active_memberships_of($1) LIMIT 1', [userId]);
      const row = rows[0];
      return row === undefined ? undefined : { organisationId: toEntityId(row.organisation_id), userId, orgRole: row.org_role, status: 'active' };
    },
    async upsertMembership(membership) {
      await tx.query(
        `INSERT INTO memberships (organisation_id, user_id, org_role, status) VALUES ($1, $2, $3, $4)
         ON CONFLICT (organisation_id, user_id) DO UPDATE SET org_role = EXCLUDED.org_role, status = EXCLUDED.status`,
        [membership.organisationId, membership.userId, membership.orgRole, membership.status],
      );
    },
    async listMembers(organisationId) {
      const rows = await tx.query<UserRow & MemberRow>(`SELECT ${USER_COLUMNS}, m.org_role, m.status AS membership_status FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.organisation_id = $1 ORDER BY u.display_name`, [organisationId]);
      return rows.map((row): { readonly user: User; readonly membership: Membership } => ({
        user: mapUser(row),
        membership: { organisationId, userId: toEntityId(row.id), orgRole: row.org_role, status: row.membership_status },
      }));
    },
  };
}

/**
 * Crée le dépôt des organisations.
 * @param tx transaction
 * @returns dépôt
 */
export function organisationRepository(tx: SqlExecutor): OrganisationRepository {
  return {
    async count() {
      const rows = await tx.query<{ readonly total: string }>('SELECT count(*) AS total FROM organisations');
      return Number(rows[0]?.total ?? 0);
    },
    async findById(id) {
      const rows = await tx.query<OrganisationRow>('SELECT id, slug, name, status FROM organisations WHERE id = $1', [id]);
      const row = rows[0];
      return row === undefined ? undefined : { id: toEntityId(row.id), slug: row.slug, name: row.name, status: row.status };
    },
    async insert(organisation) {
      await tx.query('INSERT INTO organisations (id, slug, name, status) VALUES ($1, $2, $3, $4)', [organisation.id, organisation.slug, organisation.name, organisation.status]);
    },
    ...memberships(tx),
  };
}
