/**
 * Dépôt PostgreSQL des projets, avec verrouillage optimiste par version.
 *
 * Couche : moyenne (portfolio/structure). Règles : RI-COD-09, RI-DON-09, RI-DON-02.
 */
import { toEntityId } from '@pajavamba/kernel';
import { HttpProblem, type SqlExecutor } from '@pajavamba/ops';
import type { Project, ProjectRepository } from '@pajavamba/portfolio-fonctionnel';

interface ProjectRow {
  readonly organisation_id: string;
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly status: Project['status'];
  readonly visibility: Project['visibility'];
  readonly methodology_pack_key: Project['methodologyPackKey'];
  readonly time_zone: string;
  readonly configuration_ready: boolean;
  readonly open_item_count: number;
  readonly created_by: string | null;
  readonly closed_at: Date | null;
  readonly closure_summary: string | null;
  readonly archived_at: Date | null;
  readonly deletion_scheduled_for: Date | null;
  readonly deletion_from_status: Project['status'] | null;
  readonly version: number;
}

const COLUMNS = 'organisation_id, id, key, name, description, status, visibility, methodology_pack_key, time_zone, configuration_ready, open_item_count, created_by, closed_at, closure_summary, archived_at, deletion_scheduled_for, deletion_from_status, version';

/** Lectures unitaires par clé : requêtes littérales, aucune valeur interpolée (RI-COD-09). */
const SELECT_BY: Readonly<Record<'id' | 'key', string>> = {
  id: `SELECT ${COLUMNS} FROM projects WHERE id = $1`,
  key: `SELECT ${COLUMNS} FROM projects WHERE key = $1`,
};

const millis = (value: Date | null): number | null => (value === null ? null : value.getTime());
const date = (value: number | null): Date | null => (value === null ? null : new Date(value));

/**
 * Convertit une ligne de projet.
 * @param row ligne
 * @returns projet
 */
function mapProject(row: ProjectRow): Project {
  return {
    id: toEntityId(row.id), organisationId: toEntityId(row.organisation_id), key: row.key, name: row.name, description: row.description, status: row.status,
    visibility: row.visibility, methodologyPackKey: row.methodology_pack_key, timeZone: row.time_zone, configurationReady: row.configuration_ready,
    openItemCount: row.open_item_count, createdBy: row.created_by === null ? null : toEntityId(row.created_by), closedAt: millis(row.closed_at),
    closureSummary: row.closure_summary, archivedAt: millis(row.archived_at), deletionScheduledFor: millis(row.deletion_scheduled_for),
    deletionFromStatus: row.deletion_from_status, version: row.version,
  };
}

const CONCURRENT_UPDATE = new HttpProblem({ status: 412, code: 'portfolio.concurrent_update', title: 'Version périmée', detail: 'Ce projet a été modifié entre-temps. Rechargez-le puis réessayez.' });

/**
 * Liste, champs dérivés et purge des projets.
 * @param tx transaction
 * @returns opérations
 */
function projectMaintenance(tx: SqlExecutor): Pick<ProjectRepository, 'list' | 'updateDerived' | 'listDueForPurge' | 'delete'> {
  return {
    async list(filter) {
      const statuses = filter.includeArchived ? ['draft', 'active', 'closed', 'archived', 'pending_deletion'] : ['draft', 'active', 'closed'];
      const rows = filter.projectIds === 'all'
        ? await tx.query<ProjectRow>(`SELECT ${COLUMNS} FROM projects WHERE status = ANY($1) ORDER BY name`, [statuses])
        : await tx.query<ProjectRow>(`SELECT ${COLUMNS} FROM projects WHERE status = ANY($1) AND id = ANY($2) ORDER BY name`, [statuses, filter.projectIds]);
      return rows.map(mapProject);
    },
    async updateDerived(id, fields) {
      await tx.query(
        'UPDATE projects SET configuration_ready = coalesce($2, configuration_ready), open_item_count = greatest(0, open_item_count + $3) WHERE id = $1',
        [id, fields.configurationReady ?? null, fields.openItemDelta ?? 0],
      );
    },
    async listDueForPurge(now) {
      const rows = await tx.query<ProjectRow>(`SELECT ${COLUMNS} FROM projects WHERE status = 'pending_deletion' AND deletion_scheduled_for <= $1`, [new Date(now)]);
      return rows.map(mapProject);
    },
    async delete(id) {
      await tx.query('DELETE FROM projects WHERE id = $1', [id]);
    },
  };
}

/**
 * Crée le dépôt des projets.
 * @param tx transaction
 * @returns dépôt
 */
export function projectRepository(tx: SqlExecutor): ProjectRepository {
  const findOne = async (column: 'id' | 'key', value: string): Promise<Project | undefined> => {
    const rows = await tx.query<ProjectRow>(SELECT_BY[column], [value]);
    return rows[0] === undefined ? undefined : mapProject(rows[0]);
  };
  return {
    findById: async (id) => findOne('id', id),
    findByKey: async (key) => findOne('key', key),
    async insert(project) {
      await tx.query(
        `INSERT INTO projects (organisation_id, id, key, name, description, status, visibility, methodology_pack_key, time_zone, created_by, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [project.organisationId, project.id, project.key, project.name, project.description, project.status, project.visibility, project.methodologyPackKey, project.timeZone, project.createdBy, project.version],
      );
    },
    async update(project) {
      const rows = await tx.query(
        `UPDATE projects SET name = $2, description = $3, status = $4, visibility = $5, configuration_ready = $6, open_item_count = $7, closed_at = $8,
           closure_summary = $9, archived_at = $10, deletion_scheduled_for = $11, deletion_from_status = $12, version = $13
         WHERE id = $1 AND version = $13 - 1 RETURNING id`,
        [project.id, project.name, project.description, project.status, project.visibility, project.configurationReady, project.openItemCount, date(project.closedAt), project.closureSummary, date(project.archivedAt), date(project.deletionScheduledFor), project.deletionFromStatus, project.version],
      );
      if (rows.length === 0) throw CONCURRENT_UPDATE;
    },
    ...projectMaintenance(tx),
  };
}
