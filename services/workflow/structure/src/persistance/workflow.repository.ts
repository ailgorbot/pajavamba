/**
 * Dépôt PostgreSQL des workflows, versions et projets connus.
 *
 * Couche : moyenne (workflow/structure). Règles : RI-COD-09, RG-WF-001 (mise à jour réservée aux
 * brouillons, contrôlée aussi par déclencheur).
 */
import { toEntityId, type OrganisationId } from '@pajavamba/kernel';
import type { SqlExecutor } from '@pajavamba/ops';
import type { ProjectSnapshot, Workflow, WorkflowDefinition, WorkflowRepository, WorkflowVersion } from '@pajavamba/workflow-fonctionnel';

interface VersionRow {
  readonly id: string;
  readonly workflow_id: string;
  readonly number: number;
  readonly status: WorkflowVersion['status'];
  readonly definition: WorkflowDefinition;
  readonly published_at: Date | null;
}

interface WorkflowRow {
  readonly id: string;
  readonly project_id: string;
  readonly key: string;
  readonly name: string;
}

const VERSION_COLUMNS = 'id, workflow_id, number, status, definition, published_at';

/**
 * Convertit une ligne de version.
 * @param row ligne
 * @returns version
 */
function mapVersion(row: VersionRow): WorkflowVersion {
  return { id: row.id, workflowId: row.workflow_id, number: row.number, status: row.status, definition: row.definition, publishedAt: row.published_at === null ? null : row.published_at.getTime() };
}

/**
 * Crée le dépôt des workflows.
 * @param tx transaction
 * @param organisationId organisation courante
 * @returns dépôt
 */
export function workflowRepository(tx: SqlExecutor, organisationId: OrganisationId): WorkflowRepository {
  return {
    async findProject(ref) {
      const [column, value] = 'id' in ref ? ['id', ref.id] : ['key', ref.key];
      const rows = await tx.query<{ readonly id: string; readonly key: string; readonly status: string; readonly pack_key: string }>(`SELECT id, key, status, pack_key FROM projects WHERE ${column} = $1`, [value]);
      const row = rows[0];
      return row === undefined ? undefined : { id: toEntityId(row.id), key: row.key, status: row.status, packKey: row.pack_key };
    },
    async upsertProject(project: ProjectSnapshot) {
      await tx.query(
        'INSERT INTO projects (organisation_id, id, key, status, pack_key) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (organisation_id, id) DO UPDATE SET status = EXCLUDED.status',
        [organisationId, project.id, project.key, project.status, project.packKey],
      );
    },
    async deleteProject(id) {
      await tx.query('DELETE FROM projects WHERE id = $1', [id]);
    },
    async findWorkflow(projectId, key) {
      const rows = await tx.query<WorkflowRow>('SELECT id, project_id, key, name FROM workflows WHERE project_id = $1 AND key = $2', [projectId, key]);
      const row = rows[0];
      return row === undefined ? undefined : { id: row.id, projectId: row.project_id, key: row.key, name: row.name };
    },
    async listWorkflows(projectId) {
      const workflows = await tx.query<WorkflowRow>('SELECT id, project_id, key, name FROM workflows WHERE project_id = $1 ORDER BY key', [projectId]);
      const versions = await tx.query<VersionRow>(`SELECT ${VERSION_COLUMNS} FROM workflow_versions WHERE workflow_id = ANY($1) ORDER BY number`, [workflows.map((row) => row.id)]);
      return workflows.map((row) => ({ workflow: { id: row.id, projectId: row.project_id, key: row.key, name: row.name } satisfies Workflow, versions: versions.filter((version) => version.workflow_id === row.id).map(mapVersion) }));
    },
    async insertWorkflow(workflow) {
      await tx.query('INSERT INTO workflows (organisation_id, id, project_id, key, name) VALUES ($1, $2, $3, $4, $5)', [organisationId, workflow.id, workflow.projectId, workflow.key, workflow.name]);
    },
    async findVersion(id) {
      const rows = await tx.query<VersionRow>(`SELECT ${VERSION_COLUMNS} FROM workflow_versions WHERE id = $1`, [id]);
      return rows[0] === undefined ? undefined : mapVersion(rows[0]);
    },
    async latestVersionNumber(workflowId) {
      const rows = await tx.query<{ readonly latest: number | null }>('SELECT max(number) AS latest FROM workflow_versions WHERE workflow_id = $1', [workflowId]);
      return rows[0]?.latest ?? 0;
    },
    async insertVersion(version) {
      await tx.query(
        'INSERT INTO workflow_versions (organisation_id, id, workflow_id, number, status, definition, published_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [organisationId, version.id, version.workflowId, version.number, version.status, JSON.stringify(version.definition), version.publishedAt === null ? null : new Date(version.publishedAt)],
      );
    },
    async updateDraft(version) {
      await tx.query("UPDATE workflow_versions SET status = $2, definition = $3, published_at = $4 WHERE id = $1 AND status = 'draft'", [version.id, version.status, JSON.stringify(version.definition), version.publishedAt === null ? null : new Date(version.publishedAt)]);
    },
  };
}
