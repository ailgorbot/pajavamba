/**
 * Dépôt PostgreSQL des vues de lecture : projets, états, éléments, activité.
 *
 * Couche : moyenne (query/structure). Règles : RI-COD-09 (SQL paramétré, y compris pour la
 * recherche plein texte), §5.11 (configuration française et `unaccent`).
 */
import { toEntityId } from '@pajavamba/kernel';
import type { SqlExecutor } from '@pajavamba/ops';
import type { ActivityView, ItemView, QueryRepository, StateView } from '@pajavamba/query-fonctionnel';

interface ItemRow {
  readonly id: string;
  readonly project_id: string;
  readonly project_key: string;
  readonly key: string;
  readonly type_key: string;
  readonly title: string;
  readonly state_key: string;
  readonly state_name: string | null;
  readonly state_category: ItemView['stateCategory'];
  readonly workflow_key: string | null;
  readonly priority: string;
  readonly parent_id: string | null;
  readonly assignee_id: string | null;
  readonly estimate: string | null;
  readonly rank: string;
  readonly confidentiality: ItemView['confidentiality'];
}

const ITEM_SELECT = `
  SELECT i.id, i.project_id, p.key AS project_key, i.key, i.type_key, i.title, i.state_key, s.name AS state_name, i.state_category, s.workflow_key,
         i.priority, i.parent_id, i.assignee_id, i.estimate, i.rank, i.confidentiality
  FROM work_item_views i
  JOIN projects p ON p.id = i.project_id AND p.organisation_id = i.organisation_id
  LEFT JOIN workflow_states s ON s.version_id = i.workflow_version_id AND s.key = i.state_key AND s.organisation_id = i.organisation_id`;

/**
 * Convertit une ligne d'élément.
 * @param row ligne
 * @returns vue
 */
function mapItem(row: ItemRow): ItemView {
  return {
    id: row.id, projectId: toEntityId(row.project_id), projectKey: row.project_key, key: row.key, typeKey: row.type_key, title: row.title, stateKey: row.state_key,
    stateName: row.state_name ?? row.state_key, stateCategory: row.state_category, workflowKey: row.workflow_key ?? '', priority: row.priority, parentId: row.parent_id,
    assigneeId: row.assignee_id, estimate: row.estimate === null ? null : Number(row.estimate), rank: row.rank, confidentiality: row.confidentiality,
  };
}

/**
 * Vues des éléments et du journal d'activité.
 * @param tx transaction
 * @returns opérations
 */
function itemViews(tx: SqlExecutor): Pick<QueryRepository, 'listItems' | 'listActivity'> {
  return {
    async listItems(filter) {
      const rows = await tx.query<ItemRow>(
        `${ITEM_SELECT}
         WHERE NOT i.deleted
           AND ($1::uuid[] IS NULL OR i.project_id = ANY($1))
           AND ($2 OR i.confidentiality = 'normal')
           AND ($3 OR i.state_category <> 'done')
           AND ($4::text IS NULL OR i.type_key = $4)
           AND ($5::text IS NULL OR s.workflow_key = $5)
           AND ($6::text IS NULL OR i.tsv @@ websearch_to_tsquery('french', unaccent($6)) OR i.key = upper($6) OR i.title % $6)
         ORDER BY ${filter.text === null ? 'i.rank' : 'ts_rank(i.tsv, websearch_to_tsquery(\'french\', unaccent($6))) DESC, i.rank'}
         LIMIT $7`,
        [filter.projectIds === 'all' ? null : filter.projectIds, filter.includeRestricted, filter.includeDone, filter.typeKey, filter.workflowKey, filter.text, filter.limit],
      );
      return rows.map(mapItem);
    },
    async listActivity(projectId, limit) {
      const rows = await tx.query<{ readonly occurred_at: Date; readonly event_code: string; readonly resource_key: string | null; readonly actor_ref: string | null; readonly params: ActivityView['params'] }>(
        'SELECT occurred_at, event_code, resource_key, actor_ref, params FROM activity_entries WHERE project_id = $1 ORDER BY seq DESC LIMIT $2',
        [projectId, limit],
      );
      return rows.map((row) => ({ occurredAt: row.occurred_at.toISOString(), eventCode: row.event_code, resourceKey: row.resource_key, actorId: row.actor_ref, params: row.params }));
    },
  };
}

/**
 * Crée le dépôt des vues.
 * @param tx transaction
 * @returns dépôt
 */
export function queryRepository(tx: SqlExecutor): QueryRepository {
  return {
    async findProject(ref) {
      const [column, value] = 'id' in ref ? ['id', ref.id] : ['key', ref.key];
      const rows = await tx.query<{ readonly id: string; readonly key: string; readonly name: string; readonly status: string }>(`SELECT id, key, name, status FROM projects WHERE ${column} = $1`, [value]);
      const row = rows[0];
      return row === undefined ? undefined : { id: toEntityId(row.id), key: row.key, name: row.name, status: row.status };
    },
    async latestStates(projectId, workflowKey) {
      const rows = await tx.query<{ readonly version_id: string; readonly workflow_key: string; readonly key: string; readonly name: string; readonly category: StateView['category']; readonly position: number; readonly wip_limit: number | null }>(
        `SELECT version_id, workflow_key, key, name, category, position, wip_limit FROM workflow_states
         WHERE project_id = $1 AND workflow_key = $2 AND version_number = (SELECT max(version_number) FROM workflow_states WHERE project_id = $1 AND workflow_key = $2)
         ORDER BY position`,
        [projectId, workflowKey],
      );
      return rows.map((row) => ({ versionId: row.version_id, workflowKey: row.workflow_key, key: row.key, name: row.name, category: row.category, position: row.position, wipLimit: row.wip_limit }));
    },
    async workflowKeys(projectId) {
      const rows = await tx.query<{ readonly workflow_key: string }>('SELECT DISTINCT workflow_key FROM workflow_states WHERE project_id = $1 ORDER BY workflow_key', [projectId]);
      return rows.map((row) => row.workflow_key);
    },
    ...itemViews(tx),
  };
}
