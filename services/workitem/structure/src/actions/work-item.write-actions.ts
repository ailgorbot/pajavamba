/**
 * Actions d'écriture des éléments : création, modification, transition, assignation, rang,
 * corbeille et restauration.
 *
 * Couche : moyenne (workitem/structure). Règles : RI-API-01, RI-API-05 (`If-Match` sur PATCH et
 * DELETE), RG-WI-001 à RG-WI-009.
 */
import { defineAction, type ActionCall, type ActionDefinition, type ActionResponse, type RegisteredAction } from '@pajavamba/contracts';
import { toEntityId, type DomainError, type ExecutionContext, type Result, type UseCaseOutput } from '@pajavamba/kernel';
import { checkIfMatch, parseInput, requireContext, requireIfMatch, serviceWrite, type ServiceRuntimeShape } from '@pajavamba/ops';
import { assignWorkItem, createWorkItem, rankWorkItem, transitionWorkItem, trashWorkItem, updateWorkItem, type WorkItem, type WorkItemDependencies } from '@pajavamba/workitem-fonctionnel';
import { itemBody } from './work-item.body.ts';
import { AssignInput, CreateInput, presentFields, RankInput, targetOf, TransitionInput, UpdateInput } from './work-item.schemas.ts';

/** Fabrique de l'environnement lié à l'organisation courante. */
export type RuntimeFor = (organisationId: string) => ServiceRuntimeShape<WorkItemDependencies>;

type ItemUseCase = (dependencies: WorkItemDependencies, context: ExecutionContext) => Promise<Result<UseCaseOutput<WorkItem>, DomainError>>;
type Builder = (call: ActionCall) => { readonly changedFields: readonly string[]; readonly run: ItemUseCase };

const ITEM_PATH = '/projects/:projectRef/work-items/:itemKey';

/**
 * Déclare une écriture sur un élément.
 * @param runtimeFor environnement par organisation
 * @param declaration action
 * @param build construction du cas d'usage à partir de l'appel
 * @returns action enregistrée
 */
function itemWrite(runtimeFor: RuntimeFor, declaration: ActionDefinition, build: Builder): RegisteredAction {
  const created = declaration.id === 'work_item.create';
  return {
    definition: defineAction(declaration),
    handle: async (call): Promise<ActionResponse> => {
      const context = requireContext(call.context);
      const { changedFields, run } = build(call);
      return serviceWrite(runtimeFor(context.organisationId), call, {
        actionId: declaration.id, resourceType: 'work_item', context, replayable: true, changedFields,
        execute: async (dependencies) => run(dependencies, context),
        respond: (item) => ({ status: created ? 201 : 200, body: itemBody(item), etag: item.version }),
        resourceId: (item) => item.id,
      });
    },
  };
}

const create: Builder = (call) => {
  const input = parseInput(CreateInput, call.body);
  const { ref } = targetOf(call);
  return { changedFields: Object.keys(input), run: async (dependencies, context) => createWorkItem(dependencies, context, { ...input, ref }) };
};

const update: Builder = (call) => {
  const changes = presentFields(parseInput(UpdateInput, call.body));
  const expectedVersion = requireIfMatch(call.headers.ifMatch);
  const target = targetOf(call);
  return { changedFields: Object.keys(changes), run: async (dependencies, context) => updateWorkItem(dependencies, context, { ...target, expectedVersion, changes }) };
};

const transition: Builder = (call) => {
  const { toState } = parseInput(TransitionInput, call.body);
  return { changedFields: ['stateKey'], run: async (dependencies, context) => transitionWorkItem(dependencies, context, { ...targetOf(call), toState }) };
};

const assign: Builder = (call) => {
  const { assigneeId } = parseInput(AssignInput, call.body);
  const assignee = assigneeId === null ? null : toEntityId<'user'>(assigneeId);
  return { changedFields: ['assigneeId'], run: async (dependencies, context) => assignWorkItem(dependencies, context, { ...targetOf(call), assigneeId: assignee }) };
};

const rank: Builder = (call) => {
  const { beforeKey } = parseInput(RankInput, call.body);
  return { changedFields: ['rank'], run: async (dependencies, context) => rankWorkItem(dependencies, context, { ...targetOf(call), beforeRef: beforeKey }) };
};

const remove: Builder = (call) => {
  const target = targetOf(call);
  const expected = call.headers.ifMatch;
  const run: ItemUseCase = async (dependencies, context) => {
    const current = (await dependencies.items.findByKey(target.itemRef)) ?? (await dependencies.items.findById(target.itemRef));
    if (current !== undefined) checkIfMatch(expected, current.version);
    return trashWorkItem(dependencies, context, { ...target, deleted: true });
  };
  return { changedFields: ['deletedAt'], run };
};

const restore: Builder = (call) => ({ changedFields: ['deletedAt'], run: async (dependencies, context) => trashWorkItem(dependencies, context, { ...targetOf(call), deleted: false }) });

const DECLARATIONS: readonly (readonly [ActionDefinition, Builder])[] = [
  [{ id: 'work_item.create', permission: 'work_item:create', risk: 'R1', method: 'POST', path: '/projects/:projectRef/work-items', reversible: true, description: 'Crée un élément de travail.', rules: ['RG-WI-001', 'RG-WI-002', 'RG-WI-003', 'RG-WI-005'] }, create],
  [{ id: 'work_item.update', permission: 'work_item:update', risk: 'R1', method: 'PATCH', path: ITEM_PATH, reversible: true, description: 'Modifie un élément (If-Match obligatoire).', rules: ['RG-WI-002', 'RG-WI-003'] }, update],
  [{ id: 'work_item.transition', permission: 'work_item:transition', risk: 'R1', method: 'POST', path: `${ITEM_PATH}/actions/transition`, reversible: true, description: 'Fait passer un élément dans un nouvel état selon son workflow.', rules: ['RG-WI-005', 'RG-WF-004', 'RG-WF-005'] }, transition],
  [{ id: 'work_item.assign', permission: 'work_item:assign', risk: 'R1', method: 'POST', path: `${ITEM_PATH}/actions/assign`, reversible: true, description: 'Assigne ou désassigne un élément.', rules: [] }, assign],
  [{ id: 'work_item.rank', permission: 'work_item:rank', risk: 'R1', method: 'POST', path: `${ITEM_PATH}/actions/rank`, reversible: true, description: 'Ordonne un élément dans le backlog.', rules: [] }, rank],
  [{ id: 'work_item.delete', permission: 'work_item:delete', risk: 'R2', method: 'DELETE', path: ITEM_PATH, reversible: true, description: 'Place un élément dans la corbeille (30 jours).', rules: ['RG-WI-008'] }, remove],
  [{ id: 'work_item.restore', permission: 'work_item:delete', risk: 'R2', method: 'POST', path: `${ITEM_PATH}/actions/restore`, reversible: true, description: 'Restaure un élément de la corbeille.', rules: ['RG-WI-008'] }, restore],
];

/**
 * Déclare les actions d'écriture des éléments.
 * @param runtimeFor environnement par organisation
 * @returns actions
 */
export function writeActions(runtimeFor: RuntimeFor): RegisteredAction[] {
  return DECLARATIONS.map(([declaration, build]) => itemWrite(runtimeFor, declaration, build));
}
