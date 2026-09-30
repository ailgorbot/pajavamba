/**
 * Cas d'usage de modification d'un élément : édition, transition, assignation, rang, corbeille.
 *
 * Couche : basse (workitem/fonctionnel). Règles : RG-WI-002, RG-WI-003, RG-WI-005, RG-WI-008,
 * RG-WF-004, RG-PRJ-004, RI-DON-09 (verrouillage optimiste).
 */
import { domainError, err, ok, type DomainError, type ExecutionContext, type Result, type UseCaseOutput, type UserId } from '@pajavamba/kernel';
import { checkParent } from '../domaine/hierarchy.ts';
import { rankBetween } from '../domaine/rank.ts';
import { evaluateTransition } from '../domaine/transition.ts';
import { validateEstimate, validateLongText, validateTitle, type Confidentiality, type Priority, type WorkItem } from '../domaine/work-item.ts';
import type { WorkItemDependencies } from '../ports/workitem.ports.ts';
import { itemEvent, loadItem, READ, WORKITEM_EVENTS, type ItemTarget, type LoadedItem } from './item-access.ts';

/** Champs modifiables d'un élément. */
export interface WorkItemChanges {
  readonly title?: string;
  readonly description?: string;
  readonly acceptanceCriteria?: string;
  readonly priority?: Priority;
  readonly estimate?: number | null;
  readonly parentKey?: string | null;
  readonly confidentiality?: Confidentiality;
}

/** Entrée de la modification. */
export interface UpdateWorkItemInput extends ItemTarget {
  readonly expectedVersion: number;
  readonly changes: WorkItemChanges;
}

type Output = Promise<Result<UseCaseOutput<WorkItem>, DomainError>>;
type Change = { readonly from: string | null; readonly to: string | null };

const VERSION_MISMATCH = domainError('workitem.version_mismatch', 'precondition', "L'élément a été modifié entre-temps. Rechargez-le puis réessayez.");
const WORKFLOW_MISSING = domainError('workitem.workflow_not_published', 'conflict', 'La version de workflow de cet élément est introuvable.');
const RANK_TARGET = domainError('workitem.rank_target_not_found', 'validation', "L'élément de référence du classement est introuvable.");
const TRACKED = ['title', 'priority', 'estimate', 'stateKey', 'assigneeId', 'parentId', 'confidentiality', 'deletedAt'] as const;

/**
 * Valeur d'historique d'un champ suivi.
 * @param value valeur
 * @returns représentation textuelle ou `null`
 */
function historyValue(value: string | number | null): string | null {
  return value === null ? null : String(value);
}

/**
 * Champs modifiés entre deux versions (les textes longs ne sont jamais recopiés).
 * @param before élément avant
 * @param after élément après
 * @returns changements par champ
 */
function diff(before: WorkItem, after: WorkItem): Record<string, Change> {
  const changes: Record<string, Change> = {};
  for (const field of TRACKED) {
    if (before[field] !== after[field]) changes[field] = { from: historyValue(before[field]), to: historyValue(after[field]) };
  }
  if (before.description !== after.description) changes['description'] = { from: null, to: null };
  if (before.acceptanceCriteria !== after.acceptanceCriteria) changes['acceptanceCriteria'] = { from: null, to: null };
  return changes;
}

/**
 * Enregistre la modification, l'historique et l'événement.
 * @param dependencies dépendances
 * @param context contexte
 * @param change élément avant, après (version incrémentée) et type d'événement
 * @returns sortie du cas d'usage
 */
async function persist(dependencies: WorkItemDependencies, context: ExecutionContext, change: { readonly before: WorkItem; readonly after: WorkItem; readonly type: string }): Output {
  const { before, after, type } = change;
  await dependencies.items.update(after);
  const changes = diff(before, after);
  await dependencies.items.appendHistory({ workItemId: after.id, occurredAt: dependencies.clock.now(), actorId: context.actor.kind === 'user' ? context.actor.userId : null, action: type.split('.').at(-2) ?? 'updated', changes });
  const extra = type === WORKITEM_EVENTS.transitioned ? { fromState: before.stateKey, fromCategory: before.stateCategory, toCategory: after.stateCategory } : {};
  return ok({ result: after, events: [itemEvent(type, after, { ...extra, fields: Object.keys(changes).join(',') })] });
}

/**
 * Valide la description et les critères d'acceptation.
 * @param item élément courant
 * @param changes champs modifiés
 * @returns textes validés ou erreur
 */
function validateTexts(item: WorkItem, changes: WorkItemChanges): Result<{ readonly description: string; readonly acceptanceCriteria: string }, DomainError> {
  const description = validateLongText(changes.description ?? item.description, 'description');
  if (!description.ok) return description;
  const criteria = validateLongText(changes.acceptanceCriteria ?? item.acceptanceCriteria, 'criteria');
  return criteria.ok ? ok({ description: description.value, acceptanceCriteria: criteria.value }) : criteria;
}

/**
 * Valide les champs textuels et numériques modifiés.
 * @param item élément courant
 * @param changes champs modifiés
 * @returns élément avec les champs appliqués (hors parent) ou erreur
 */
function applyFields(item: WorkItem, changes: WorkItemChanges): Result<WorkItem, DomainError> {
  const title = changes.title === undefined ? ok(item.title) : validateTitle(changes.title);
  if (!title.ok) return title;
  const texts = validateTexts(item, changes);
  if (!texts.ok) return texts;
  const estimate = changes.estimate === undefined ? ok(item.estimate) : validateEstimate(changes.estimate);
  if (!estimate.ok) return estimate;
  return ok({ ...item, ...texts.value, title: title.value, priority: changes.priority ?? item.priority, estimate: estimate.value, confidentiality: changes.confidentiality ?? item.confidentiality });
}

/**
 * Applique un changement de parent en contrôlant la hiérarchie.
 * @param dependencies dépendances
 * @param context contexte
 * @param request élément courant, projet et nouveau parent
 * @returns élément rattaché ou erreur
 */
async function applyParent(dependencies: WorkItemDependencies, context: ExecutionContext, request: ItemTarget & { readonly item: WorkItem; readonly parentKey: string | null }): Promise<Result<WorkItem, DomainError>> {
  const { item } = request;
  if (request.parentKey === null) return ok({ ...item, parentId: null, ancestors: [] });
  const parent = await loadItem(dependencies, context, { ...READ, ref: request.ref, itemRef: request.parentKey });
  if (!parent.ok) return parent;
  const type = (await dependencies.configuration.listTypes(item.projectId)).find((candidate) => candidate.key === item.typeKey);
  if (type === undefined) return ok({ ...item, parentId: parent.value.item.id, ancestors: [...parent.value.item.ancestors, parent.value.item.id] });
  const ancestors = checkParent(type, item.id, parent.value.item);
  return ancestors.ok ? ok({ ...item, parentId: parent.value.item.id, ancestors: ancestors.value }) : ancestors;
}

/**
 * Charge un élément modifiable avec la permission demandée.
 * @param dependencies dépendances
 * @param context contexte
 * @param request élément et permission
 * @returns élément chargé ou erreur
 */
async function loadWritable(dependencies: WorkItemDependencies, context: ExecutionContext, request: ItemTarget & { readonly permission: string; readonly includeDeleted?: boolean }): Promise<Result<LoadedItem, DomainError>> {
  const risk = request.permission === 'work_item:delete' ? 'R2' : 'R1';
  return loadItem(dependencies, context, { ...request, risk, writable: true });
}

/**
 * Modifie un élément (`work_item.update`).
 * @param dependencies dépendances
 * @param context contexte
 * @param input élément, version attendue (`If-Match`) et champs modifiés
 * @returns élément modifié
 */
export async function updateWorkItem(dependencies: WorkItemDependencies, context: ExecutionContext, input: UpdateWorkItemInput): Output {
  const loaded = await loadWritable(dependencies, context, { ...input, permission: 'work_item:update' });
  if (!loaded.ok) return loaded;
  const before = loaded.value.item;
  if (before.version !== input.expectedVersion) return err(VERSION_MISMATCH);
  const fields = applyFields(before, input.changes);
  if (!fields.ok) return fields;
  const parented = input.changes.parentKey === undefined ? fields : await applyParent(dependencies, context, { ...input, item: fields.value, parentKey: input.changes.parentKey });
  if (!parented.ok) return parented;
  return persist(dependencies, context, { before, after: { ...parented.value, version: before.version + 1 }, type: WORKITEM_EVENTS.updated });
}

/**
 * Fait passer un élément dans un nouvel état (`work_item.transition`).
 * @param dependencies dépendances
 * @param context contexte
 * @param input élément et état cible
 * @returns élément modifié
 */
export async function transitionWorkItem(dependencies: WorkItemDependencies, context: ExecutionContext, input: ItemTarget & { readonly toState: string }): Output {
  const loaded = await loadWritable(dependencies, context, { ...input, permission: 'work_item:transition' });
  if (!loaded.ok) return loaded;
  const { item } = loaded.value;
  const snapshot = await dependencies.configuration.findWorkflowVersion(item.workflowVersionId);
  if (snapshot === undefined) return err(WORKFLOW_MISSING);
  const facts = { openChildren: await dependencies.items.countOpenChildren(item.id), targetCount: await dependencies.items.countInState(item.projectId, input.toState, snapshot.workflowKey) };
  const target = evaluateTransition(snapshot, item, { targetKey: input.toState, facts });
  if (!target.ok) return target;
  const resolvedAt = target.value.category === 'done' ? dependencies.clock.now() : null;
  return persist(dependencies, context, { before: item, after: { ...item, stateKey: target.value.key, stateCategory: target.value.category, resolvedAt, version: item.version + 1 }, type: WORKITEM_EVENTS.transitioned });
}

/**
 * Assigne ou désassigne un élément (`work_item.assign`).
 * @param dependencies dépendances
 * @param context contexte
 * @param input élément et responsable (ou `null`)
 * @returns élément modifié
 */
export async function assignWorkItem(dependencies: WorkItemDependencies, context: ExecutionContext, input: ItemTarget & { readonly assigneeId: UserId | null }): Output {
  const loaded = await loadWritable(dependencies, context, { ...input, permission: 'work_item:assign' });
  if (!loaded.ok) return loaded;
  const { item } = loaded.value;
  return persist(dependencies, context, { before: item, after: { ...item, assigneeId: input.assigneeId, version: item.version + 1 }, type: WORKITEM_EVENTS.assigned });
}

/**
 * Place un élément juste avant un autre, ou en fin de backlog (`work_item.rank`).
 * @param dependencies dépendances
 * @param context contexte
 * @param input élément et élément devant lequel se placer (`null` pour la fin)
 * @returns élément modifié
 */
export async function rankWorkItem(dependencies: WorkItemDependencies, context: ExecutionContext, input: ItemTarget & { readonly beforeRef: string | null }): Output {
  const loaded = await loadWritable(dependencies, context, { ...input, permission: 'work_item:rank' });
  if (!loaded.ok) return loaded;
  const { item } = loaded.value;
  let rank = rankBetween(await dependencies.items.lastRank(item.projectId), null);
  if (input.beforeRef !== null) {
    const anchor = await loadItem(dependencies, context, { ...READ, ref: input.ref, itemRef: input.beforeRef });
    const neighbours = anchor.ok ? await dependencies.items.neighbourRanks(item.projectId, anchor.value.item.id, item.id) : undefined;
    if (neighbours === undefined) return err(RANK_TARGET);
    rank = rankBetween(neighbours.before, neighbours.target);
  }
  return persist(dependencies, context, { before: item, after: { ...item, rank, version: item.version + 1 }, type: WORKITEM_EVENTS.ranked });
}

/**
 * Place un élément en corbeille ou le restaure (`work_item.delete`, `work_item.restore`).
 * @param dependencies dépendances
 * @param context contexte
 * @param input élément et sens (vrai pour supprimer, faux pour restaurer)
 * @returns élément modifié
 */
export async function trashWorkItem(dependencies: WorkItemDependencies, context: ExecutionContext, input: ItemTarget & { readonly deleted: boolean }): Output {
  const loaded = await loadWritable(dependencies, context, { ...input, permission: 'work_item:delete', includeDeleted: true });
  if (!loaded.ok) return loaded;
  const { item } = loaded.value;
  if ((item.deletedAt !== null) === input.deleted) return err(domainError('workitem.trash_state', 'conflict', input.deleted ? 'Cet élément est déjà dans la corbeille.' : "Cet élément n'est pas dans la corbeille."));
  const after = { ...item, deletedAt: input.deleted ? dependencies.clock.now() : null, version: item.version + 1 };
  return persist(dependencies, context, { before: item, after, type: input.deleted ? WORKITEM_EVENTS.deleted : WORKITEM_EVENTS.restored });
}
