/**
 * Racine de composition du service workitem (câblage manuel, RI-ARC-09) : environnement, actions,
 * consommateur des événements de configuration (portfolio, workflow).
 *
 * Couche : moyenne (workitem/structure). Règles : RI-SRV-04, RI-SRV-11, RG-WF-001.
 */
import { join } from 'node:path';
import { EVENT_TYPES, type CloudEvent, type EventConsumer, type RegisteredAction } from '@pajavamba/contracts';
import { toEntityId, type AccessPolicy, type Clock, type IdGenerator } from '@pajavamba/kernel';
import { consumeOnce, type MigrationSet, type SqlExecutor } from '@pajavamba/ops';
import { recordPack, recordProject, recordWorkflowVersion, type ItemType, type WorkflowSnapshot, type WorkItemDependencies } from '@pajavamba/workitem-fonctionnel';
import type pg from 'pg';
import { workItemActions, type RuntimeFor } from '../actions/work-item.actions.ts';
import { configurationRepository } from '../persistance/configuration.repository.ts';
import { workItemRepository } from '../persistance/work-item.repository.ts';

/** Migrations du service workitem. */
export const WORKITEM_MIGRATIONS: MigrationSet = { service: 'workitem', directory: join(import.meta.dirname, '../../migrations') };

const SCOPE = { schema: 'workitem', role: 'pv_workitem_app' } as const;
const CONSUMER = 'workitem.configuration';

/**
 * Valeur textuelle d'un champ d'événement (chaîne vide si absent ou d'un autre type).
 * @param value valeur
 * @returns texte
 */
function textOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Paramètres du service workitem. */
export interface WorkItemSettings {
  readonly pool: pg.Pool;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly policy: AccessPolicy;
  readonly notify: () => void;
}

/** Service workitem câblé. */
export interface WorkItemService {
  readonly actions: readonly RegisteredAction[];
  readonly consumers: readonly EventConsumer[];
}

/** Forme d'un workflow dans les événements de workflow. */
interface WorkflowPayload {
  readonly key: string;
  readonly versionId: string;
  readonly number: number;
  readonly definition: Pick<WorkflowSnapshot, 'states' | 'transitions'>;
}

/**
 * Convertit un workflow d'événement en instantané.
 * @param payload données de l'événement
 * @returns instantané
 */
function snapshotOf(payload: WorkflowPayload): WorkflowSnapshot {
  return { versionId: payload.versionId, workflowKey: payload.key, number: payload.number, states: payload.definition.states, transitions: payload.definition.transitions };
}

/**
 * Relit les données structurées d'un événement produit par le service workflow.
 * Conversion justifiée : le schéma de l'événement est garanti par son producteur (§5.7).
 * @param event événement
 * @returns données typées
 */
function packPayload(event: CloudEvent): { readonly types: readonly ItemType[]; readonly workflows: readonly WorkflowPayload[] } {
  return event.data as unknown as { readonly types: readonly ItemType[]; readonly workflows: readonly WorkflowPayload[] };
}

/**
 * Applique un événement de configuration.
 * @param dependencies dépendances
 * @param event événement
 */
async function apply(dependencies: WorkItemDependencies, event: CloudEvent): Promise<void> {
  const projectId = toEntityId<'project'>(typeof event.data['projectId'] === 'string' ? event.data['projectId'] : event.subject);
  switch (event.type) {
    case EVENT_TYPES.packInstantiated: {
      const payload = packPayload(event);
      await recordPack(dependencies, projectId, payload.types, payload.workflows.map(snapshotOf));
      return;
    }
    case EVENT_TYPES.workflowPublished:
      await recordWorkflowVersion(dependencies, projectId, snapshotOf(event.data as unknown as WorkflowPayload));
      return;
    case EVENT_TYPES.projectPurged:
      await dependencies.configuration.deleteProject(toEntityId(event.subject));
      return;
    default:
      await recordProject(dependencies, { id: toEntityId(event.subject), key: textOf(event.data['key']), status: textOf(event.data['status']) });
  }
}

/**
 * Câble le service workitem.
 * @param settings paramètres
 * @returns service câblé
 */
export function createWorkItemService(settings: WorkItemSettings): WorkItemService {
  const runtimeFor: RuntimeFor = (organisationId) => ({
    pool: settings.pool,
    scope: SCOPE,
    notify: settings.notify,
    dependenciesOf: (tx: SqlExecutor): WorkItemDependencies => ({ configuration: configurationRepository(tx, toEntityId(organisationId)), items: workItemRepository(tx, toEntityId(organisationId)), policy: settings.policy, clock: settings.clock, ids: settings.ids }),
  });
  const projectEvents = [EVENT_TYPES.projectCreated, EVENT_TYPES.projectActivated, EVENT_TYPES.projectClosed, EVENT_TYPES.projectReopened, EVENT_TYPES.projectArchived, EVENT_TYPES.projectUnarchived, EVENT_TYPES.projectDeletionScheduled, EVENT_TYPES.projectDeletionCancelled];
  const consumer: EventConsumer = {
    name: CONSUMER,
    types: [...projectEvents, EVENT_TYPES.projectPurged, EVENT_TYPES.packInstantiated, EVENT_TYPES.workflowPublished],
    async handle(event) {
      const runtime = runtimeFor(event.pvorganisation);
      await consumeOnce({ pool: settings.pool, scope: { ...SCOPE, organisationId: event.pvorganisation }, consumer: CONSUMER, eventId: event.id, correlationId: event.pvcorrelation }, async (tx) => {
        await apply(runtime.dependenciesOf(tx), event);
        return [];
      });
    },
  };
  return { actions: workItemActions(runtimeFor), consumers: [consumer] };
}
