/**
 * Racine de composition du service workflow (câblage manuel, RI-ARC-09) : environnement, actions,
 * consommateur des événements de portfolio.
 *
 * Couche : moyenne (workflow/structure). Règles : RI-API-01, RI-SRV-04, RI-SRV-11, RG-WF-001.
 */
import { join } from 'node:path';
import { defineAction, EVENT_TYPES, type ActionCall, type EventConsumer, type RegisteredAction } from '@pajavamba/contracts';
import { parseProjectRef, toEntityId, type AccessPolicy, type Clock, type IdGenerator, type ProjectRef } from '@pajavamba/kernel';
import { consumeOnce, HttpProblem, parseInput, requireContext, serviceRead, serviceWrite, type MigrationSet, type ServiceRuntimeShape, type SqlExecutor } from '@pajavamba/ops';
import { draftWorkflow, instantiatePack, listProjectWorkflows, publishWorkflowVersion, type WorkflowDependencies, type WorkflowVersion } from '@pajavamba/workflow-fonctionnel';
import type pg from 'pg';
import { z } from 'zod';
import { workflowRepository } from '../persistance/workflow.repository.ts';

/** Migrations du service workflow. */
export const WORKFLOW_MIGRATIONS: MigrationSet = { service: 'workflow', directory: join(import.meta.dirname, '../../migrations') };

const SCOPE = { schema: 'workflow', role: 'pv_workflow_app' } as const;
const CONSUMER = 'workflow.projects';

/**
 * Valeur textuelle d'un champ d'événement (chaîne vide si absent ou d'un autre type).
 * @param value valeur
 * @returns texte
 */
function textOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
const NOT_FOUND = new HttpProblem({ status: 404, code: 'access.not_found', title: 'Ressource introuvable', detail: "La ressource demandée n'existe pas ou n'est pas accessible." });

const StateSchema = z.strictObject({ key: z.string().max(41), name: z.string().max(80), category: z.enum(['todo', 'in_progress', 'done']), wipLimit: z.number().int().min(1).nullable().default(null), wipBlocking: z.boolean().default(false) });
const ConditionSchema = z.union([z.strictObject({ kind: z.literal('field_set'), field: z.enum(['assignee', 'estimate', 'description', 'acceptance_criteria']) }), z.strictObject({ kind: z.literal('children_done') })]);
const TransitionSchema = z.strictObject({ key: z.string().max(41), name: z.string().max(80), from: z.string().max(41).nullable(), to: z.string().max(41), conditions: z.array(ConditionSchema).max(10).default([]), requiresApproval: z.boolean().default(false) });
const DraftInput = z.strictObject({
  key: z.string().max(41).describe('Clé du workflow'),
  name: z.string().max(80).describe('Libellé'),
  definition: z.strictObject({ states: z.array(StateSchema).max(30), transitions: z.array(TransitionSchema).max(200) }).describe('États et transitions'),
});

/** Paramètres du service workflow. */
export interface WorkflowSettings {
  readonly pool: pg.Pool;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly policy: AccessPolicy;
  readonly notify: () => void;
}

/** Service workflow câblé. */
export interface WorkflowService {
  readonly actions: readonly RegisteredAction[];
  readonly consumers: readonly EventConsumer[];
}

/**
 * Environnement lié à une organisation.
 * @param settings paramètres
 * @param organisationId organisation
 * @returns environnement
 */
function runtimeFor(settings: WorkflowSettings, organisationId: string): ServiceRuntimeShape<WorkflowDependencies> {
  return { pool: settings.pool, scope: SCOPE, notify: settings.notify, dependenciesOf: (tx: SqlExecutor) => ({ workflows: workflowRepository(tx, toEntityId(organisationId)), policy: settings.policy, clock: settings.clock, ids: settings.ids }) };
}

/**
 * Référence de projet du chemin.
 * @param call appel
 * @returns référence
 */
function refOf(call: ActionCall): ProjectRef {
  const ref = parseProjectRef(call.params['projectRef']);
  if (ref === undefined) throw NOT_FOUND;
  return ref;
}

/**
 * Représentation API d'une version.
 * @param version version
 * @returns corps JSON
 */
function versionBody(version: WorkflowVersion): Record<string, unknown> {
  return { id: version.id, workflowId: version.workflowId, number: version.number, status: version.status, definition: version.definition, publishedAt: version.publishedAt === null ? null : new Date(version.publishedAt).toISOString() };
}

/**
 * Déclare les actions du service.
 * @param settings paramètres
 * @returns actions
 */
function actions(settings: WorkflowSettings): RegisteredAction[] {
  return [
    {
      definition: defineAction({ id: 'workflow.list', permission: 'project:read', risk: 'R0', method: 'GET', path: '/projects/:projectRef/workflows', reversible: true, description: "Liste les workflows d'un projet et leurs versions.", rules: ['RG-WF-001'] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const list = await serviceRead(runtimeFor(settings, context.organisationId), context.organisationId, async (dependencies) => listProjectWorkflows(dependencies, context, refOf(call)));
        return { status: 200, body: { data: list.map(({ workflow, versions }) => ({ ...workflow, versions: versions.map(versionBody) })), page: { nextCursor: null, limit: list.length } } };
      },
    },
    {
      definition: defineAction({ id: 'workflow.draft', permission: 'workflow:configure', risk: 'R2', method: 'POST', path: '/projects/:projectRef/workflows', reversible: true, description: "Crée une version brouillon d'un workflow.", rules: ['RG-WF-002'] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const input = parseInput(DraftInput, call.body);
        return serviceWrite(runtimeFor(settings, context.organisationId), call, { actionId: 'workflow.draft', resourceType: 'workflow_version', context, replayable: true, changedFields: ['definition'], execute: async (dependencies) => draftWorkflow(dependencies, context, { ...input, ref: refOf(call) }), respond: (version) => ({ status: 201, body: versionBody(version) }), resourceId: (version) => version.id });
      },
    },
    {
      definition: defineAction({ id: 'workflow.publish', permission: 'workflow:configure', risk: 'R2', method: 'POST', path: '/projects/:projectRef/workflow-versions/:versionId/actions/publish', reversible: false, description: 'Publie une version brouillon, qui devient immuable.', rules: ['RG-WF-001'] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const versionId = call.params['versionId'] ?? '';
        return serviceWrite(runtimeFor(settings, context.organisationId), call, { actionId: 'workflow.publish', resourceType: 'workflow_version', context, replayable: true, changedFields: ['status'], execute: async (dependencies) => publishWorkflowVersion(dependencies, context, { ref: refOf(call), versionId }), respond: (version) => ({ status: 200, body: versionBody(version) }), resourceId: (version) => version.id });
      },
    },
  ];
}

/**
 * Consommateur des événements de projet : instanciation du pack, statut, purge.
 * @param settings paramètres
 * @returns consommateur
 */
function projectConsumer(settings: WorkflowSettings): EventConsumer {
  const statusEvents: string[] = [EVENT_TYPES.projectActivated, EVENT_TYPES.projectClosed, EVENT_TYPES.projectReopened, EVENT_TYPES.projectArchived, EVENT_TYPES.projectUnarchived, EVENT_TYPES.projectDeletionScheduled, EVENT_TYPES.projectDeletionCancelled];
  return {
    name: CONSUMER,
    types: [EVENT_TYPES.projectCreated, EVENT_TYPES.projectPurged, ...statusEvents],
    async handle(event) {
      const runtime = runtimeFor(settings, event.pvorganisation);
      await consumeOnce({ pool: settings.pool, scope: { ...SCOPE, organisationId: event.pvorganisation }, consumer: CONSUMER, eventId: event.id, correlationId: event.pvcorrelation }, async (tx) => {
        const dependencies = runtime.dependenciesOf(tx);
        const snapshot = { id: toEntityId<'project'>(event.subject), key: textOf(event.data['key']), status: textOf(event.data['status']), packKey: textOf(event.data['methodologyPackKey']) };
        if (event.type === EVENT_TYPES.projectPurged) {
          await dependencies.workflows.deleteProject(snapshot.id);
          return [];
        }
        if (event.type !== EVENT_TYPES.projectCreated) {
          await dependencies.workflows.upsertProject(snapshot);
          return [];
        }
        const outcome = await instantiatePack(dependencies, snapshot);
        return outcome.ok ? outcome.value.events.map((domainEvent) => ({ kind: 'event', type: domainEvent.type, aggregateId: domainEvent.aggregateId, aggregateVersion: domainEvent.aggregateVersion, payload: domainEvent.data })) : [];
      });
    },
  };
}

/**
 * Câble le service workflow.
 * @param settings paramètres
 * @returns service câblé
 */
export function createWorkflowService(settings: WorkflowSettings): WorkflowService {
  return { actions: actions(settings), consumers: [projectConsumer(settings)] };
}
