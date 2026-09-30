/**
 * Dépôt PostgreSQL de la configuration locale : projets, types, versions de workflow publiées.
 *
 * Couche : moyenne (workitem/structure). Règles : RI-COD-09, RG-WI-001 (compteur atomique).
 */
import { toEntityId, type OrganisationId } from '@pajavamba/kernel';
import type { SqlExecutor } from '@pajavamba/ops';
import type { ConfigurationRepository, ItemType, WorkflowSnapshot } from '@pajavamba/workitem-fonctionnel';

interface VersionRow {
  readonly id: string;
  readonly workflow_key: string;
  readonly number: number;
  readonly definition: Pick<WorkflowSnapshot, 'states' | 'transitions'>;
}

/**
 * Convertit une ligne de version.
 * @param row ligne
 * @returns instantané
 */
function mapVersion(row: VersionRow): WorkflowSnapshot {
  return { versionId: row.id, workflowKey: row.workflow_key, number: row.number, states: row.definition.states, transitions: row.definition.transitions };
}

/**
 * Copies locales des versions de workflow publiées.
 * @param tx transaction
 * @param organisationId paramètre
 * @returns opérations
 */
function workflowSnapshots(tx: SqlExecutor, organisationId: OrganisationId): Pick<ConfigurationRepository, 'currentWorkflow' | 'findWorkflowVersion' | 'saveWorkflowVersion'> {
  return {
    async currentWorkflow(projectId, workflowKey) {
      const rows = await tx.query<VersionRow>('SELECT id, workflow_key, number, definition FROM workflow_versions WHERE project_id = $1 AND workflow_key = $2 ORDER BY number DESC LIMIT 1', [projectId, workflowKey]);
      return rows[0] === undefined ? undefined : mapVersion(rows[0]);
    },
    async findWorkflowVersion(versionId) {
      const rows = await tx.query<VersionRow>('SELECT id, workflow_key, number, definition FROM workflow_versions WHERE id = $1', [versionId]);
      return rows[0] === undefined ? undefined : mapVersion(rows[0]);
    },
    async saveWorkflowVersion(projectId, snapshot) {
      await tx.query(
        'INSERT INTO workflow_versions (organisation_id, id, project_id, workflow_key, number, definition) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING',
        [organisationId, snapshot.versionId, projectId, snapshot.workflowKey, snapshot.number, JSON.stringify({ states: snapshot.states, transitions: snapshot.transitions })],
      );
    },
  };
}

/**
 * Projection locale des projets et compteur des numéros d'éléments.
 * @param tx transaction
 * @param organisationId paramètre
 * @returns opérations
 */
function projectSnapshots(tx: SqlExecutor, organisationId: OrganisationId): Pick<ConfigurationRepository, 'findProject' | 'upsertProject' | 'deleteProject' | 'nextNumber'> {
  return {
    async findProject(ref) {
      const [column, value] = 'id' in ref ? ['id', ref.id] : ['key', ref.key];
      const rows = await tx.query<{ readonly id: string; readonly key: string; readonly status: string }>(`SELECT id, key, status FROM projects WHERE ${column} = $1`, [value]);
      const row = rows[0];
      return row === undefined ? undefined : { id: toEntityId(row.id), key: row.key, status: row.status };
    },
    async upsertProject(project) {
      await tx.query('INSERT INTO projects (organisation_id, id, key, status) VALUES ($1, $2, $3, $4) ON CONFLICT (organisation_id, id) DO UPDATE SET status = EXCLUDED.status', [organisationId, project.id, project.key, project.status]);
    },
    async deleteProject(id) {
      await tx.query('DELETE FROM projects WHERE id = $1', [id]);
    },
    async nextNumber(projectId) {
      const rows = await tx.query<{ readonly allocated: string }>('UPDATE projects SET next_item_number = next_item_number + 1 WHERE id = $1 RETURNING next_item_number - 1 AS allocated', [projectId]);
      return Number(rows[0]?.allocated ?? 0);
    },
  };
}

/**
 * Crée le dépôt de configuration.
 * @param tx transaction
 * @param organisationId organisation courante
 * @returns dépôt
 */
export function configurationRepository(tx: SqlExecutor, organisationId: OrganisationId): ConfigurationRepository {
  return {
    async listTypes(projectId) {
      const rows = await tx.query<{ readonly key: string; readonly name: string; readonly level: number; readonly allowed_parent_type_keys: readonly string[]; readonly workflow_key: string }>(
        'SELECT key, name, level, allowed_parent_type_keys, workflow_key FROM work_item_types WHERE project_id = $1 ORDER BY level, key',
        [projectId],
      );
      return rows.map((row): ItemType => ({ key: row.key, name: row.name, level: row.level, allowedParentKeys: row.allowed_parent_type_keys, workflowKey: row.workflow_key }));
    },
    async replaceTypes(projectId, types) {
      await tx.query('DELETE FROM work_item_types WHERE project_id = $1', [projectId]);
      for (const type of types) {
        await tx.query('INSERT INTO work_item_types (organisation_id, project_id, key, name, level, allowed_parent_type_keys, workflow_key) VALUES ($1, $2, $3, $4, $5, $6, $7)', [organisationId, projectId, type.key, type.name, type.level, type.allowedParentKeys, type.workflowKey]);
      }
    },
    ...workflowSnapshots(tx, organisationId),
    ...projectSnapshots(tx, organisationId),
  };
}
