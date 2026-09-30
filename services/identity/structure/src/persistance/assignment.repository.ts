/**
 * Dépôt PostgreSQL des attributions de rôles.
 *
 * Couche : moyenne (identity/structure). Règles : RI-COD-09, RI-DON-02 (RLS par organisation).
 */
import type { AssignmentRepository, RoleAssignment } from '@pajavamba/identity-fonctionnel';
import { toEntityId } from '@pajavamba/kernel';
import type { SqlExecutor } from '@pajavamba/ops';

interface AssignmentRow {
  readonly organisation_id: string;
  readonly id: string;
  readonly user_id: string;
  readonly role_key: string;
  readonly scope_type: 'organisation' | 'project';
  readonly scope_id: string;
  readonly effect: 'allow' | 'deny';
  readonly granted_by: string | null;
}

const COLUMNS = 'organisation_id, id, user_id, role_key, scope_type, scope_id, effect, granted_by';

/**
 * Convertit une ligne d'attribution.
 * @param row ligne
 * @returns attribution
 */
function mapAssignment(row: AssignmentRow): RoleAssignment {
  return {
    id: row.id,
    organisationId: toEntityId(row.organisation_id),
    userId: toEntityId(row.user_id),
    roleKey: row.role_key,
    scope: row.scope_type === 'project' ? { type: 'project', projectId: toEntityId(row.scope_id) } : { type: 'organisation' },
    effect: row.effect,
    grantedBy: row.granted_by === null ? null : toEntityId(row.granted_by),
  };
}

/**
 * Crée le dépôt des attributions.
 * @param tx transaction
 * @returns dépôt
 */
export function assignmentRepository(tx: SqlExecutor): AssignmentRepository {
  return {
    async insert(assignment) {
      const scopeId = assignment.scope.type === 'project' ? assignment.scope.projectId : assignment.organisationId;
      await tx.query(
        'INSERT INTO role_assignments (organisation_id, id, user_id, role_key, scope_type, scope_id, effect, granted_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [assignment.organisationId, assignment.id, assignment.userId, assignment.roleKey, assignment.scope.type, scopeId, assignment.effect, assignment.grantedBy],
      );
    },
    async findById(organisationId, id) {
      const rows = await tx.query<AssignmentRow>(`SELECT ${COLUMNS} FROM role_assignments WHERE organisation_id = $1 AND id = $2`, [organisationId, id]);
      return rows[0] === undefined ? undefined : mapAssignment(rows[0]);
    },
    async delete(organisationId, id) {
      await tx.query('DELETE FROM role_assignments WHERE organisation_id = $1 AND id = $2', [organisationId, id]);
    },
    async listForProject(organisationId, projectId) {
      const rows = await tx.query<AssignmentRow>(`SELECT ${COLUMNS} FROM role_assignments WHERE organisation_id = $1 AND scope_type = 'project' AND scope_id = $2 ORDER BY created_at`, [organisationId, projectId]);
      return rows.map(mapAssignment);
    },
    async listForUser(organisationId, userId) {
      const rows = await tx.query<AssignmentRow>(`SELECT ${COLUMNS} FROM role_assignments WHERE organisation_id = $1 AND user_id = $2 ORDER BY created_at`, [organisationId, userId]);
      return rows.map(mapAssignment);
    },
    async countOwners(organisationId) {
      const rows = await tx.query<{ readonly total: string }>(
        `SELECT count(*) AS total FROM role_assignments a JOIN users u ON u.id = a.user_id
         WHERE a.organisation_id = $1 AND a.role_key = 'owner' AND a.effect = 'allow' AND u.status = 'active'`,
        [organisationId],
      );
      return Number(rows[0]?.total ?? 0);
    },
  };
}
