/**
 * Dépôt PostgreSQL des éléments, commentaires et historique, avec verrouillage optimiste.
 *
 * Couche : moyenne (workitem/structure). Règles : RI-COD-09, RI-DON-09.
 */
import { toEntityId, type OrganisationId } from '@pajavamba/kernel';
import { HttpProblem, type SqlExecutor } from '@pajavamba/ops';
import type { Comment, HistoryEntry, WorkItem, WorkItemRepository } from '@pajavamba/workitem-fonctionnel';

interface ItemRow {
  readonly id: string;
  readonly project_id: string;
  readonly number: string;
  readonly key: string;
  readonly type_key: string;
  readonly title: string;
  readonly description: string;
  readonly acceptance_criteria: string;
  readonly state_key: string;
  readonly state_category: WorkItem['stateCategory'];
  readonly workflow_version_id: string;
  readonly priority: WorkItem['priority'];
  readonly parent_id: string | null;
  readonly ancestors: readonly string[];
  readonly assignee_id: string | null;
  readonly reporter_id: string | null;
  readonly estimate: string | null;
  readonly rank: string;
  readonly confidentiality: WorkItem['confidentiality'];
  readonly created_via: WorkItem['createdVia'];
  readonly created_at: Date;
  readonly resolved_at: Date | null;
  readonly deleted_at: Date | null;
  readonly version: number;
}

const COLUMNS = 'id, project_id, number, key, type_key, title, description, acceptance_criteria, state_key, state_category, workflow_version_id, priority, parent_id, ancestors, assignee_id, reporter_id, estimate, rank, confidentiality, created_via, created_at, resolved_at, deleted_at, version';

/** Lectures unitaires par clé : requêtes littérales, aucune valeur interpolée (RI-COD-09). */
const SELECT_BY: Readonly<Record<'id' | 'key', string>> = {
  id: `SELECT ${COLUMNS} FROM work_items WHERE id = $1`,
  key: `SELECT ${COLUMNS} FROM work_items WHERE key = $1`,
};
const millis = (value: Date | null): number | null => (value === null ? null : value.getTime());
const date = (value: number | null): Date | null => (value === null ? null : new Date(value));

/**
 * Convertit une ligne d'élément.
 * @param row ligne
 * @returns élément
 */
function mapItem(row: ItemRow): WorkItem {
  return {
    id: row.id, projectId: toEntityId(row.project_id), number: Number(row.number), key: row.key, typeKey: row.type_key, title: row.title, description: row.description,
    acceptanceCriteria: row.acceptance_criteria, stateKey: row.state_key, stateCategory: row.state_category, workflowVersionId: row.workflow_version_id, priority: row.priority,
    parentId: row.parent_id, ancestors: row.ancestors, assigneeId: row.assignee_id === null ? null : toEntityId(row.assignee_id), reporterId: row.reporter_id === null ? null : toEntityId(row.reporter_id),
    estimate: row.estimate === null ? null : Number(row.estimate), rank: row.rank, confidentiality: row.confidentiality, createdVia: row.created_via, createdAt: row.created_at.getTime(),
    resolvedAt: millis(row.resolved_at), deletedAt: millis(row.deleted_at), version: row.version,
  };
}

const CONCURRENT_UPDATE = new HttpProblem({ status: 412, code: 'workitem.concurrent_update', title: 'Version périmée', detail: "L'élément a été modifié entre-temps. Rechargez-le puis réessayez." });

/**
 * Opérations sur les commentaires et l'historique.
 * @param tx transaction
 * @param organisationId organisation courante
 * @returns opérations
 */
function discussion(tx: SqlExecutor, organisationId: OrganisationId): Pick<WorkItemRepository, 'insertComment' | 'listComments' | 'appendHistory' | 'listHistory'> {
  return {
    async insertComment(comment) {
      await tx.query('INSERT INTO comments (organisation_id, id, work_item_id, author_id, body, created_via, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [organisationId, comment.id, comment.workItemId, comment.authorId, comment.body, comment.createdVia, new Date(comment.createdAt)]);
    },
    async listComments(workItemId) {
      const rows = await tx.query<{ readonly id: string; readonly work_item_id: string; readonly author_id: string | null; readonly body: string; readonly created_via: string; readonly created_at: Date }>('SELECT id, work_item_id, author_id, body, created_via, created_at FROM comments WHERE work_item_id = $1 ORDER BY created_at', [workItemId]);
      return rows.map((row): Comment => ({ id: row.id, workItemId: row.work_item_id, authorId: row.author_id === null ? null : toEntityId(row.author_id), body: row.body, createdVia: row.created_via, createdAt: row.created_at.getTime() }));
    },
    async appendHistory(entry) {
      await tx.query('INSERT INTO work_item_history (organisation_id, work_item_id, occurred_at, actor_id, action, changes) VALUES ($1, $2, $3, $4, $5, $6)', [organisationId, entry.workItemId, new Date(entry.occurredAt), entry.actorId, entry.action, JSON.stringify(entry.changes)]);
    },
    async listHistory(workItemId) {
      const rows = await tx.query<{ readonly work_item_id: string; readonly occurred_at: Date; readonly actor_id: string | null; readonly action: string; readonly changes: HistoryEntry['changes'] }>('SELECT work_item_id, occurred_at, actor_id, action, changes FROM work_item_history WHERE work_item_id = $1 ORDER BY seq', [workItemId]);
      return rows.map((row): HistoryEntry => ({ workItemId: row.work_item_id, occurredAt: row.occurred_at.getTime(), actorId: row.actor_id === null ? null : toEntityId(row.actor_id), action: row.action, changes: row.changes }));
    },
  };
}

/**
 * Écritures des éléments (insertion et mise à jour avec verrouillage optimiste).
 * @param tx transaction
 * @param organisationId organisation courante
 * @returns opérations
 */
function itemWrites(tx: SqlExecutor, organisationId: OrganisationId): Pick<WorkItemRepository, 'insert' | 'update'> {
  return {
    async insert(item) {
      await tx.query(
        `INSERT INTO work_items (organisation_id, id, project_id, number, key, type_key, title, description, acceptance_criteria, state_key, state_category, workflow_version_id, workflow_key,
           priority, parent_id, ancestors, assignee_id, reporter_id, estimate, rank, confidentiality, created_via, created_at, version)
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, v.workflow_key, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23 FROM workflow_versions v WHERE v.id = $12`,
        [organisationId, item.id, item.projectId, item.number, item.key, item.typeKey, item.title, item.description, item.acceptanceCriteria, item.stateKey, item.stateCategory, item.workflowVersionId, item.priority, item.parentId, item.ancestors, item.assigneeId, item.reporterId, item.estimate, item.rank, item.confidentiality, item.createdVia, new Date(item.createdAt), item.version],
      );
    },
    async update(item) {
      const rows = await tx.query(
        `UPDATE work_items SET title = $2, description = $3, acceptance_criteria = $4, state_key = $5, state_category = $6, priority = $7, parent_id = $8, ancestors = $9,
           assignee_id = $10, estimate = $11, rank = $12, confidentiality = $13, resolved_at = $14, deleted_at = $15, version = $16
         WHERE id = $1 AND version = $16 - 1 RETURNING id`,
        [item.id, item.title, item.description, item.acceptanceCriteria, item.stateKey, item.stateCategory, item.priority, item.parentId, item.ancestors, item.assigneeId, item.estimate, item.rank, item.confidentiality, date(item.resolvedAt), date(item.deletedAt), item.version],
      );
      if (rows.length === 0) throw CONCURRENT_UPDATE;
    },
  };
}

/**
 * Requêtes de rang, de comptage et de sous-éléments.
 * @param tx transaction
 * @returns opérations
 */
function itemQueries(tx: SqlExecutor): Pick<WorkItemRepository, 'lastRank' | 'neighbourRanks' | 'countOpenChildren' | 'countInState' | 'listChildren'> {
  return {
    async lastRank(projectId) {
      const rows = await tx.query<{ readonly rank: string }>('SELECT rank FROM work_items WHERE project_id = $1 ORDER BY rank DESC LIMIT 1', [projectId]);
      return rows[0]?.rank ?? null;
    },
    async neighbourRanks(projectId, targetId, movingId) {
      const target = await tx.query<{ readonly rank: string }>('SELECT rank FROM work_items WHERE id = $1 AND project_id = $2', [targetId, projectId]);
      const rank = target[0]?.rank;
      if (rank === undefined) return undefined;
      const before = await tx.query<{ readonly rank: string }>('SELECT rank FROM work_items WHERE project_id = $1 AND rank < $2 AND id <> $3 ORDER BY rank DESC LIMIT 1', [projectId, rank, movingId]);
      return { before: before[0]?.rank ?? null, target: rank };
    },
    async countOpenChildren(parentId) {
      const rows = await tx.query<{ readonly total: string }>("SELECT count(*) AS total FROM work_items WHERE parent_id = $1 AND deleted_at IS NULL AND state_category <> 'done'", [parentId]);
      return Number(rows[0]?.total ?? 0);
    },
    async countInState(projectId, stateKey, workflowKey) {
      const rows = await tx.query<{ readonly total: string }>('SELECT count(*) AS total FROM work_items WHERE project_id = $1 AND state_key = $2 AND workflow_key = $3 AND deleted_at IS NULL', [projectId, stateKey, workflowKey]);
      return Number(rows[0]?.total ?? 0);
    },
    async listChildren(parentId) {
      const rows = await tx.query<ItemRow>(`SELECT ${COLUMNS} FROM work_items WHERE parent_id = $1 ORDER BY rank`, [parentId]);
      return rows.map(mapItem);
    },
  };
}

/**
 * Crée le dépôt des éléments.
 * @param tx transaction
 * @param organisationId organisation courante
 * @returns dépôt
 */
export function workItemRepository(tx: SqlExecutor, organisationId: OrganisationId): WorkItemRepository {
  const findOne = async (column: 'id' | 'key', value: string): Promise<WorkItem | undefined> => {
    const rows = await tx.query<ItemRow>(SELECT_BY[column], [value]);
    return rows[0] === undefined ? undefined : mapItem(rows[0]);
  };
  return {
    findById: async (id) => findOne('id', id),
    findByKey: async (key) => findOne('key', key),
    ...itemWrites(tx, organisationId),
    ...itemQueries(tx),
    ...discussion(tx, organisationId),
  };
}
