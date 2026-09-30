/**
 * Actions des éléments de travail : types, création, détail, modification, transition,
 * assignation, rang, corbeille, commentaires.
 *
 * Couche : moyenne (workitem/structure). Règles : RI-API-01, RI-API-05 (`If-Match` sur PATCH et
 * DELETE), RG-WI-001 à RG-WI-009.
 */
import { defineAction, type ActionCall, type ActionResponse, type RegisteredAction } from '@pajavamba/contracts';
import { parseProjectRef, toEntityId, type DomainError, type ExecutionContext, type ProjectRef, type Result, type UseCaseOutput } from '@pajavamba/kernel';
import { checkIfMatch, HttpProblem, parseInput, requireIfMatch, requireContext, serviceRead, serviceWrite, type ServiceRuntimeShape } from '@pajavamba/ops';
import { assignWorkItem, commentWorkItem, createWorkItem, getWorkItem, listItemTypes, PRIORITIES, rankWorkItem, transitionWorkItem, trashWorkItem, updateWorkItem, type WorkItem, type WorkItemDependencies } from '@pajavamba/workitem-fonctionnel';
import { z } from 'zod';
import { itemBody } from './work-item.body.ts';

/** Fabrique de l'environnement lié à l'organisation courante. */
export type RuntimeFor = (organisationId: string) => ServiceRuntimeShape<WorkItemDependencies>;

const NOT_FOUND = new HttpProblem({ status: 404, code: 'access.not_found', title: 'Ressource introuvable', detail: "La ressource demandée n'existe pas ou n'est pas accessible." });

const CreateInput = z.strictObject({
  typeKey: z.string().max(41).describe("Type d'élément"),
  title: z.string().max(255).describe('Titre'),
  description: z.string().max(65_535).default('').describe('Description (Markdown)'),
  acceptanceCriteria: z.string().max(20_000).default('').describe("Critères d'acceptation"),
  priority: z.enum(PRIORITIES).default('medium').describe('Priorité'),
  estimate: z.number().nullable().default(null).describe('Estimation'),
  parentKey: z.string().max(60).nullable().default(null).describe('Clé du parent'),
  confidentiality: z.enum(['normal', 'restricted']).default('normal').describe('Confidentialité'),
});
const UpdateInput = z.strictObject({
  title: z.string().max(255).optional(),
  description: z.string().max(65_535).optional(),
  acceptanceCriteria: z.string().max(20_000).optional(),
  priority: z.enum(PRIORITIES).optional(),
  estimate: z.number().nullable().optional(),
  parentKey: z.string().max(60).nullable().optional(),
  confidentiality: z.enum(['normal', 'restricted']).optional(),
});
const TransitionInput = z.strictObject({ toState: z.string().max(41).describe('État cible') });
const AssignInput = z.strictObject({ assigneeId: z.uuid().nullable().describe('Responsable, ou null pour désassigner') });
const RankInput = z.strictObject({ beforeKey: z.string().max(60).nullable().describe("Élément devant lequel se placer, ou null pour la fin") });
const CommentInput = z.strictObject({ body: z.string().max(20_000).describe('Commentaire (Markdown)') });

/**
 * Référence de projet et d'élément du chemin.
 * @param call appel
 * @returns références
 */
function refsOf(call: ActionCall): { readonly project: ProjectRef; readonly item: string } {
  const project = parseProjectRef(call.params['projectRef']);
  if (project === undefined) throw NOT_FOUND;
  return { project, item: call.params['itemKey'] ?? '' };
}

type ItemUseCase = (dependencies: WorkItemDependencies, context: ExecutionContext) => Promise<Result<UseCaseOutput<WorkItem>, DomainError>>;

/**
 * Déclare une écriture sur un élément.
 * @param runtimeFor environnement par organisation
 * @param declaration action
 * @param build construction du cas d'usage à partir de l'appel
 * @returns action enregistrée
 */
function itemWrite(runtimeFor: RuntimeFor, declaration: Parameters<typeof defineAction>[0], build: (call: ActionCall) => { readonly changedFields: readonly string[]; readonly run: ItemUseCase }): RegisteredAction {
  return {
    definition: defineAction(declaration),
    handle: async (call): Promise<ActionResponse> => {
      const context = requireContext(call.context);
      const { changedFields, run } = build(call);
      return serviceWrite(runtimeFor(context.organisationId), call, {
        actionId: declaration.id, resourceType: 'work_item', context, replayable: true, changedFields,
        execute: async (dependencies) => run(dependencies, context),
        respond: (item) => ({ status: declaration.method === 'POST' && declaration.id === 'work_item.create' ? 201 : 200, body: itemBody(item), etag: item.version }),
        resourceId: (item) => item.id,
      });
    },
  };
}

/**
 * Déclare les actions d'écriture des éléments.
 * @param runtimeFor environnement par organisation
 * @returns actions
 */
function writeActions(runtimeFor: RuntimeFor): RegisteredAction[] {
  const itemPath = '/projects/:projectRef/work-items/:itemKey';
  return [
    itemWrite(runtimeFor, { id: 'work_item.create', permission: 'work_item:create', risk: 'R1', method: 'POST', path: '/projects/:projectRef/work-items', reversible: true, description: 'Crée un élément de travail.', rules: ['RG-WI-001', 'RG-WI-002', 'RG-WI-003', 'RG-WI-005'] }, (call) => {
      const input = parseInput(CreateInput, call.body);
      return { changedFields: Object.keys(input), run: async (dependencies, context) => createWorkItem(dependencies, context, refsOf(call).project, input) };
    }),
    itemWrite(runtimeFor, { id: 'work_item.update', permission: 'work_item:update', risk: 'R1', method: 'PATCH', path: itemPath, reversible: true, description: 'Modifie un élément (If-Match obligatoire).', rules: ['RG-WI-002', 'RG-WI-003'] }, (call) => {
      const input = Object.fromEntries(Object.entries(parseInput(UpdateInput, call.body)).filter(([, value]) => value !== undefined));
      const expected = requireIfMatch(call.headers.ifMatch);
      const refs = refsOf(call);
      return { changedFields: Object.keys(input), run: async (dependencies, context) => updateWorkItem(dependencies, context, refs.project, refs.item, expected, input) };
    }),
    itemWrite(runtimeFor, { id: 'work_item.transition', permission: 'work_item:transition', risk: 'R1', method: 'POST', path: `${itemPath}/actions/transition`, reversible: true, description: "Fait passer un élément dans un nouvel état selon son workflow.", rules: ['RG-WI-005', 'RG-WF-004', 'RG-WF-005'] }, (call) => {
      const input = parseInput(TransitionInput, call.body);
      const refs = refsOf(call);
      return { changedFields: ['stateKey'], run: async (dependencies, context) => transitionWorkItem(dependencies, context, refs.project, refs.item, input.toState) };
    }),
    itemWrite(runtimeFor, { id: 'work_item.assign', permission: 'work_item:assign', risk: 'R1', method: 'POST', path: `${itemPath}/actions/assign`, reversible: true, description: 'Assigne ou désassigne un élément.', rules: [] }, (call) => {
      const input = parseInput(AssignInput, call.body);
      const refs = refsOf(call);
      return { changedFields: ['assigneeId'], run: async (dependencies, context) => assignWorkItem(dependencies, context, refs.project, refs.item, input.assigneeId === null ? null : toEntityId(input.assigneeId)) };
    }),
    itemWrite(runtimeFor, { id: 'work_item.rank', permission: 'work_item:rank', risk: 'R1', method: 'POST', path: `${itemPath}/actions/rank`, reversible: true, description: 'Ordonne un élément dans le backlog.', rules: [] }, (call) => {
      const input = parseInput(RankInput, call.body);
      const refs = refsOf(call);
      return { changedFields: ['rank'], run: async (dependencies, context) => rankWorkItem(dependencies, context, refs.project, refs.item, input.beforeKey) };
    }),
    itemWrite(runtimeFor, { id: 'work_item.delete', permission: 'work_item:delete', risk: 'R2', method: 'DELETE', path: itemPath, reversible: true, description: 'Place un élément dans la corbeille (30 jours).', rules: ['RG-WI-008'] }, (call) => {
      const refs = refsOf(call);
      const expected = call.headers.ifMatch;
      return { changedFields: ['deletedAt'], run: async (dependencies, context) => {
        const current = await dependencies.items.findByKey(refs.item) ?? await dependencies.items.findById(refs.item);
        if (current !== undefined) checkIfMatch(expected, current.version);
        return trashWorkItem(dependencies, context, refs.project, refs.item, true);
      } };
    }),
    itemWrite(runtimeFor, { id: 'work_item.restore', permission: 'work_item:delete', risk: 'R2', method: 'POST', path: `${itemPath}/actions/restore`, reversible: true, description: 'Restaure un élément de la corbeille.', rules: ['RG-WI-008'] }, (call) => {
      const refs = refsOf(call);
      return { changedFields: ['deletedAt'], run: async (dependencies, context) => trashWorkItem(dependencies, context, refs.project, refs.item, false) };
    }),
  ];
}

/**
 * Déclare les actions des éléments.
 * @param runtimeFor environnement par organisation
 * @returns actions enregistrées
 */
export function workItemActions(runtimeFor: RuntimeFor): RegisteredAction[] {
  return [
    {
      definition: defineAction({ id: 'work_item_type.list', permission: 'work_item:read', risk: 'R0', method: 'GET', path: '/projects/:projectRef/work-item-types', reversible: true, description: "Liste les types d'éléments et la hiérarchie du projet.", rules: ['RG-WI-002'] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const types = await serviceRead(runtimeFor(context.organisationId), context.organisationId, async (dependencies) => listItemTypes(dependencies, context, refsOf(call).project));
        return { status: 200, body: { data: types, page: { nextCursor: null, limit: types.length } } };
      },
    },
    {
      definition: defineAction({ id: 'work_item.get', permission: 'work_item:read', risk: 'R0', method: 'GET', path: '/projects/:projectRef/work-items/:itemKey', reversible: true, description: "Lit le détail d'un élément : transitions possibles, sous-éléments, commentaires, historique.", rules: ['RG-WI-007'] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const refs = refsOf(call);
        const detail = await serviceRead(runtimeFor(context.organisationId), context.organisationId, async (dependencies) => getWorkItem(dependencies, context, refs.project, refs.item));
        return { status: 200, etag: detail.item.version, body: { ...itemBody(detail.item), type: detail.type ?? null, states: detail.states, transitions: detail.transitions, children: detail.children.map(itemBody), comments: detail.comments.map((comment) => ({ ...comment, createdAt: new Date(comment.createdAt).toISOString() })), history: detail.history.map((entry) => ({ ...entry, occurredAt: new Date(entry.occurredAt).toISOString() })) } };
      },
    },
    {
      definition: defineAction({ id: 'work_item.comment', permission: 'work_item:comment', risk: 'R1', method: 'POST', path: '/projects/:projectRef/work-items/:itemKey/comments', reversible: true, description: 'Ajoute un commentaire à un élément.', rules: [] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const input = parseInput(CommentInput, call.body);
        const refs = refsOf(call);
        return serviceWrite(runtimeFor(context.organisationId), call, { actionId: 'work_item.comment', resourceType: 'comment', context, replayable: true, execute: async (dependencies) => commentWorkItem(dependencies, context, refs.project, refs.item, input.body), respond: (comment) => ({ status: 201, body: { ...comment, createdAt: new Date(comment.createdAt).toISOString() } }), resourceId: (comment) => comment.id });
      },
    },
    ...writeActions(runtimeFor),
  ];
}
