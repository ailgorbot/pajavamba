/**
 * Projection des événements dans les vues de lecture et le journal d'activité.
 *
 * Couche : moyenne (query/structure). Règles : RI-SRV-11 (idempotent, ordre par agrégat garanti par
 * la version projetée), RI-LOG-05 et RI-DON-13 (aucun texte libre dans le journal d'activité),
 * EXG-PERF-005.
 */
import { EVENT_TYPES, type CloudEvent, type EventConsumer } from '@pajavamba/contracts';
import { consumeOnce, type SqlExecutor } from '@pajavamba/ops';
import type pg from 'pg';

const CONSUMER = 'query.projection';
const SCOPE = { schema: 'query', role: 'pv_query_app' } as const;
const ACTIVITY_PARAMS = ['stateKey', 'fromState', 'priority', 'typeKey', 'status', 'fields'] as const;

const PROJECT_EVENTS: readonly string[] = [
  EVENT_TYPES.projectCreated, EVENT_TYPES.projectUpdated, EVENT_TYPES.projectActivated, EVENT_TYPES.projectClosed, EVENT_TYPES.projectReopened,
  EVENT_TYPES.projectArchived, EVENT_TYPES.projectUnarchived, EVENT_TYPES.projectDeletionScheduled, EVENT_TYPES.projectDeletionCancelled,
];
const ITEM_EVENTS: readonly string[] = [
  EVENT_TYPES.workItemCreated, EVENT_TYPES.workItemUpdated, EVENT_TYPES.workItemTransitioned, EVENT_TYPES.workItemAssigned,
  EVENT_TYPES.workItemRanked, EVENT_TYPES.workItemDeleted, EVENT_TYPES.workItemRestored,
];

/** État d'un workflow transporté par les événements de workflow. */
interface StatePayload {
  readonly key: string;
  readonly name: string;
  readonly category: string;
  readonly wipLimit: number | null;
}

/** Workflow transporté par les événements de workflow. */
interface WorkflowPayload {
  readonly key: string;
  readonly versionId: string;
  readonly number: number;
  readonly definition: { readonly states: readonly StatePayload[] };
}

/**
 * Lit un champ textuel.
 * @param event événement
 * @param key champ
 * @returns valeur ou `null`
 */
function text(event: CloudEvent, key: string): string | null {
  const value = event.data[key];
  return typeof value === 'string' ? value : null;
}

/**
 * Enregistre les états d'une version de workflow.
 * @param tx transaction
 * @param event événement
 * @param workflow version
 */
async function saveStates(tx: SqlExecutor, event: CloudEvent, workflow: WorkflowPayload): Promise<void> {
  for (const [position, state] of workflow.definition.states.entries()) {
    await tx.query(
      `INSERT INTO workflow_states (organisation_id, project_id, version_id, workflow_key, version_number, key, name, category, position, wip_limit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING`,
      [event.pvorganisation, text(event, 'projectId'), workflow.versionId, workflow.key, workflow.number, state.key, state.name, state.category, position, state.wipLimit],
    );
  }
}

/**
 * Met à jour la vue d'un élément si l'événement est plus récent que la version projetée.
 * @param tx transaction
 * @param event événement d'élément
 */
async function upsertItem(tx: SqlExecutor, event: CloudEvent): Promise<void> {
  const data = event.data;
  await tx.query(
    `INSERT INTO work_item_views (organisation_id, id, project_id, key, number, type_key, title, state_key, state_category, workflow_version_id, priority, parent_id,
       assignee_id, estimate, rank, confidentiality, deleted, aggregate_version, tsv)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, to_tsvector('french', unaccent($4 || ' ' || $7)))
     ON CONFLICT (organisation_id, id) DO UPDATE SET title = EXCLUDED.title, state_key = EXCLUDED.state_key, state_category = EXCLUDED.state_category, priority = EXCLUDED.priority,
       parent_id = EXCLUDED.parent_id, assignee_id = EXCLUDED.assignee_id, estimate = EXCLUDED.estimate, rank = EXCLUDED.rank, confidentiality = EXCLUDED.confidentiality,
       deleted = EXCLUDED.deleted, aggregate_version = EXCLUDED.aggregate_version, tsv = EXCLUDED.tsv
     WHERE work_item_views.aggregate_version < EXCLUDED.aggregate_version`,
    [event.pvorganisation, event.subject, data['projectId'], data['key'], data['number'], data['typeKey'], data['title'], data['stateKey'], data['stateCategory'], data['workflowVersionId'], data['priority'], data['parentId'], data['assigneeId'], data['estimate'], data['rank'], data['confidentiality'], data['deleted'], event.pvaggregateversion],
  );
}

/**
 * Ajoute une entrée au journal d'activité (paramètres de liste blanche uniquement).
 * @param tx transaction
 * @param event événement
 * @param projectId projet concerné
 */
async function recordActivity(tx: SqlExecutor, event: CloudEvent, projectId: string): Promise<void> {
  const params: Record<string, string | number | boolean | null> = {};
  for (const name of ACTIVITY_PARAMS) {
    const value = event.data[name];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') params[name] = value;
  }
  await tx.query(
    'INSERT INTO activity_entries (organisation_id, project_id, occurred_at, event_code, resource_key, actor_ref, params, correlation_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [event.pvorganisation, projectId, event.time, event.type, text(event, 'key'), event.pvactor, JSON.stringify(params), event.pvcorrelation],
  );
}

/**
 * Applique un événement aux vues.
 * @param tx transaction
 * @param event événement
 */
async function apply(tx: SqlExecutor, event: CloudEvent): Promise<void> {
  if (PROJECT_EVENTS.includes(event.type)) {
    await tx.query('INSERT INTO projects (organisation_id, id, key, name, status) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (organisation_id, id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status', [event.pvorganisation, event.subject, text(event, 'key'), text(event, 'name'), text(event, 'status')]);
    await recordActivity(tx, event, event.subject);
  } else if (event.type === EVENT_TYPES.projectPurged) {
    await tx.query('DELETE FROM work_item_views WHERE project_id = $1', [event.subject]);
    await tx.query('DELETE FROM activity_entries WHERE project_id = $1', [event.subject]);
    await tx.query('DELETE FROM workflow_states WHERE project_id = $1', [event.subject]);
    await tx.query('DELETE FROM projects WHERE id = $1', [event.subject]);
  } else if (event.type === EVENT_TYPES.packInstantiated) {
    // Conversion justifiée : le schéma de l'événement est garanti par le service workflow (§5.7).
    for (const workflow of (event.data['workflows'] ?? []) as unknown as readonly WorkflowPayload[]) await saveStates(tx, event, workflow);
  } else if (event.type === EVENT_TYPES.workflowPublished) {
    await saveStates(tx, event, event.data as unknown as WorkflowPayload);
  } else if (ITEM_EVENTS.includes(event.type)) {
    await upsertItem(tx, event);
    await recordActivity(tx, event, text(event, 'projectId') ?? '');
  } else if (event.type === EVENT_TYPES.commentAdded) {
    await recordActivity(tx, event, text(event, 'projectId') ?? '');
  }
}

/**
 * Crée le consommateur de projection.
 * @param pool pool PostgreSQL
 * @returns consommateur
 */
export function createProjectionConsumer(pool: pg.Pool): EventConsumer {
  return {
    name: CONSUMER,
    types: [...PROJECT_EVENTS, EVENT_TYPES.projectPurged, EVENT_TYPES.packInstantiated, EVENT_TYPES.workflowPublished, ...ITEM_EVENTS, EVENT_TYPES.commentAdded],
    async handle(event) {
      await consumeOnce({ pool, scope: { ...SCOPE, organisationId: event.pvorganisation }, consumer: CONSUMER, eventId: event.id, correlationId: event.pvcorrelation }, async (tx) => {
        await apply(tx, event);
        return [];
      });
    },
  };
}
