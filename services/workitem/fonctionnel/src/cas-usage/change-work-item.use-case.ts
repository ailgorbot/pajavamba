/**
 * Cas d'usage de modification d'un élément : édition, transition, assignation, rang, corbeille.
 *
 * Couche : basse (workitem/fonctionnel). Règles : RG-WI-002, RG-WI-003, RG-WI-005, RG-WI-008,
 * RG-WF-004, RG-PRJ-004, RI-DON-09 (verrouillage optimiste).
 */
import { domainError, err, ok, type DomainError, type ExecutionContext, type ProjectRef, type Result, type UseCaseOutput, type UserId } from '@pajavamba/kernel';
import { checkParent } from '../domaine/hierarchy.ts';
import { rankBetween } from '../domaine/rank.ts';
import { evaluateTransition } from '../domaine/transition.ts';
import { validateEstimate, validateLongText, validateTitle, type Confidentiality, type Priority, type WorkItem } from '../domaine/work-item.ts';
import type { WorkItemDependencies } from '../ports/workitem.ports.ts';
import { itemEvent, loadItem, WORKITEM_EVENTS } from './item-access.ts';

/** Modification d'un élément. */
export interface UpdateWorkItemInput {
  readonly title?: string;
  readonly description?: string;
  readonly acceptanceCriteria?: string;
  readonly priority?: Priority;
  readonly estimate?: number | null;
  readonly parentKey?: string | null;
  readonly confidentiality?: Confidentiality;
}

type Output = Promise<Result<UseCaseOutput<WorkItem>, DomainError>>;

const VERSION_MISMATCH = domainError('workitem.version_mismatch', 'precondition', "L'élément a été modifié entre-temps. Rechargez-le puis réessayez.");
const WORKFLOW_MISSING = domainError('workitem.workflow_not_published', 'conflict', 'La version de workflow de cet élément est introuvable.');
const RANK_TARGET = domainError('workitem.rank_target_not_found', 'validation', "L'élément de référence du classement est introuvable.");

/**
 * Enregistre la modification, l'historique et l'événement.
 * @param dependencies dépendances
 * @param context contexte
 * @param before élément avant
 * @param after élément après (version incrémentée)
 * @param type type d'événement
 * @returns sortie du cas d'usage
 */
async function persist(dependencies: WorkItemDependencies, context: ExecutionContext, before: WorkItem, after: WorkItem, type: string): Output {
  await dependencies.items.update(after);
  const tracked = ['title', 'priority', 'estimate', 'stateKey', 'assigneeId', 'parentId', 'confidentiality', 'deletedAt'] as const;
  const changes: Record<string, { readonly from: string | null; readonly to: string | null }> = {};
  for (const field of tracked) {
    if (before[field] !== after[field]) changes[field] = { from: before[field] === null ? null : String(before[field]), to: after[field] === null ? null : String(after[field]) };
  }
  if (before.description !== after.description) changes['description'] = { from: null, to: null };
  if (before.acceptanceCriteria !== after.acceptanceCriteria) changes['acceptanceCriteria'] = { from: null, to: null };
  await dependencies.items.appendHistory({ workItemId: after.id, occurredAt: dependencies.clock.now(), actorId: context.actor.kind === 'user' ? context.actor.userId : null, action: type.split('.').at(-2) ?? 'updated', changes });
  const extra = type === WORKITEM_EVENTS.transitioned ? { fromState: before.stateKey, fromCategory: before.stateCategory, toCategory: after.stateCategory } : {};
  return ok({ result: after, events: [itemEvent(type, after, { ...extra, fields: Object.keys(changes).join(',') })] });
}

/**
 * Applique les champs modifiés et valide le nouveau parent.
 * @param dependencies dépendances
 * @param context contexte
 * @param ref projet
 * @param item élément courant
 * @param input champs modifiés
 * @returns élément modifié ou erreur
 */
async function applyUpdate(dependencies: WorkItemDependencies, context: ExecutionContext, ref: ProjectRef, item: WorkItem, input: UpdateWorkItemInput): Promise<Result<WorkItem, DomainError>> {
  const title = input.title === undefined ? ok(item.title) : validateTitle(input.title);
  if (!title.ok) return title;
  const description = validateLongText(input.description ?? item.description, 'description');
  if (!description.ok) return description;
  const criteria = validateLongText(input.acceptanceCriteria ?? item.acceptanceCriteria, 'criteria');
  if (!criteria.ok) return criteria;
  const estimate = input.estimate === undefined ? ok(item.estimate) : validateEstimate(input.estimate);
  if (!estimate.ok) return estimate;
  let hierarchy: { readonly parentId: string | null; readonly ancestors: readonly string[] } = { parentId: item.parentId, ancestors: item.ancestors };
  if (input.parentKey !== undefined) {
    const parent = input.parentKey === null ? undefined : await loadItem(dependencies, context, ref, input.parentKey, { permission: 'work_item:read', risk: 'R0', writable: false });
    if (parent !== undefined && !parent.ok) return parent;
    const type = (await dependencies.configuration.listTypes(item.projectId)).find((candidate) => candidate.key === item.typeKey);
    const ancestors = parent === undefined || type === undefined ? ok([]) : checkParent(type, item.id, parent.value.item);
    if (!ancestors.ok) return ancestors;
    hierarchy = { parentId: parent === undefined ? null : parent.value.item.id, ancestors: ancestors.value };
  }
  return ok({ ...item, title: title.value, description: description.value, acceptanceCriteria: criteria.value, priority: input.priority ?? item.priority, estimate: estimate.value, confidentiality: input.confidentiality ?? item.confidentiality, ...hierarchy, version: item.version + 1 });
}

/**
 * Modifie un élément (`work_item.update`).
 * @param dependencies dépendances
 * @param context contexte
 * @param ref projet
 * @param itemRef élément
 * @param expectedVersion version attendue (`If-Match`)
 * @param input champs modifiés
 * @returns élément modifié
 */
export async function updateWorkItem(dependencies: WorkItemDependencies, context: ExecutionContext, ref: ProjectRef, itemRef: string, expectedVersion: number, input: UpdateWorkItemInput): Output {
  const loaded = await loadItem(dependencies, context, ref, itemRef, { permission: 'work_item:update', risk: 'R1', writable: true });
  if (!loaded.ok) return loaded;
  if (loaded.value.item.version !== expectedVersion) return err(VERSION_MISMATCH);
  const updated = await applyUpdate(dependencies, context, ref, loaded.value.item, input);
  return updated.ok ? persist(dependencies, context, loaded.value.item, updated.value, WORKITEM_EVENTS.updated) : updated;
}

/**
 * Fait passer un élément dans un nouvel état (`work_item.transition`).
 * @param dependencies dépendances
 * @param context contexte
 * @param ref projet
 * @param itemRef élément
 * @param targetState état cible
 * @returns élément modifié
 */
export async function transitionWorkItem(dependencies: WorkItemDependencies, context: ExecutionContext, ref: ProjectRef, itemRef: string, targetState: string): Output {
  const loaded = await loadItem(dependencies, context, ref, itemRef, { permission: 'work_item:transition', risk: 'R1', writable: true });
  if (!loaded.ok) return loaded;
  const { item } = loaded.value;
  const snapshot = await dependencies.configuration.findWorkflowVersion(item.workflowVersionId);
  if (snapshot === undefined) return err(WORKFLOW_MISSING);
  const facts = { openChildren: await dependencies.items.countOpenChildren(item.id), targetCount: await dependencies.items.countInState(item.projectId, targetState, snapshot.workflowKey) };
  const target = evaluateTransition(snapshot, item, targetState, facts);
  if (!target.ok) return target;
  const resolvedAt = target.value.category === 'done' ? dependencies.clock.now() : null;
  return persist(dependencies, context, item, { ...item, stateKey: target.value.key, stateCategory: target.value.category, resolvedAt, version: item.version + 1 }, WORKITEM_EVENTS.transitioned);
}

/**
 * Assigne ou désassigne un élément (`work_item.assign`).
 * @param dependencies dépendances
 * @param context contexte
 * @param ref projet
 * @param itemRef élément
 * @param assigneeId responsable ou `null`
 * @returns élément modifié
 */
export async function assignWorkItem(dependencies: WorkItemDependencies, context: ExecutionContext, ref: ProjectRef, itemRef: string, assigneeId: UserId | null): Output {
  const loaded = await loadItem(dependencies, context, ref, itemRef, { permission: 'work_item:assign', risk: 'R1', writable: true });
  if (!loaded.ok) return loaded;
  return persist(dependencies, context, loaded.value.item, { ...loaded.value.item, assigneeId, version: loaded.value.item.version + 1 }, WORKITEM_EVENTS.assigned);
}

/**
 * Place un élément juste avant un autre, ou en fin de backlog (`work_item.rank`).
 * @param dependencies dépendances
 * @param context contexte
 * @param ref projet
 * @param itemRef élément
 * @param beforeRef élément devant lequel se placer, ou `null` pour la fin
 * @returns élément modifié
 */
export async function rankWorkItem(dependencies: WorkItemDependencies, context: ExecutionContext, ref: ProjectRef, itemRef: string, beforeRef: string | null): Output {
  const loaded = await loadItem(dependencies, context, ref, itemRef, { permission: 'work_item:rank', risk: 'R1', writable: true });
  if (!loaded.ok) return loaded;
  const { item } = loaded.value;
  let rank = rankBetween(await dependencies.items.lastRank(item.projectId), null);
  if (beforeRef !== null) {
    const anchor = await loadItem(dependencies, context, ref, beforeRef, { permission: 'work_item:read', risk: 'R0', writable: false });
    const neighbours = anchor.ok ? await dependencies.items.neighbourRanks(item.projectId, anchor.value.item.id, item.id) : undefined;
    if (neighbours === undefined) return err(RANK_TARGET);
    rank = rankBetween(neighbours.before, neighbours.target);
  }
  return persist(dependencies, context, item, { ...item, rank, version: item.version + 1 }, WORKITEM_EVENTS.ranked);
}

/**
 * Place un élément en corbeille ou le restaure (`work_item.delete`, `work_item.restore`).
 * @param dependencies dépendances
 * @param context contexte
 * @param ref projet
 * @param itemRef élément
 * @param deleted vrai pour supprimer, faux pour restaurer
 * @returns élément modifié
 */
export async function trashWorkItem(dependencies: WorkItemDependencies, context: ExecutionContext, ref: ProjectRef, itemRef: string, deleted: boolean): Output {
  const loaded = await loadItem(dependencies, context, ref, itemRef, { permission: 'work_item:delete', risk: 'R2', writable: true, includeDeleted: true });
  if (!loaded.ok) return loaded;
  const { item } = loaded.value;
  if ((item.deletedAt !== null) === deleted) return err(domainError('workitem.trash_state', 'conflict', deleted ? 'Cet élément est déjà dans la corbeille.' : "Cet élément n'est pas dans la corbeille."));
  const after = { ...item, deletedAt: deleted ? dependencies.clock.now() : null, version: item.version + 1 };
  return persist(dependencies, context, item, after, deleted ? WORKITEM_EVENTS.deleted : WORKITEM_EVENTS.restored);
}
