/**
 * Cas d'usage `work_item.create` : création d'un élément dans l'état initial de son workflow.
 *
 * Couche : basse (workitem/fonctionnel). Règles : RG-WI-001, RG-WI-002, RG-WI-003, RG-WI-005,
 * RG-PRJ-004, RG-WI-009 (canal de création tracé).
 */
import { actorUserId, domainError, err, ok, type DomainError, type ExecutionContext, type ProjectRef, type Result, type UseCaseOutput } from '@pajavamba/kernel';
import { checkParent, type ItemType } from '../domaine/hierarchy.ts';
import { rankBetween } from '../domaine/rank.ts';
import { initialState, type SnapshotState, type WorkflowSnapshot } from '../domaine/transition.ts';
import { itemKey, validateEstimate, validateLongText, validateTitle, type Confidentiality, type CreatedVia, type Priority, type WorkItem } from '../domaine/work-item.ts';
import type { ProjectSnapshot, WorkItemDependencies } from '../ports/workitem.ports.ts';
import { itemEvent, loadItem, loadProject, READ, WORKITEM_EVENTS } from './item-access.ts';

/** Entrée de la création. */
export interface CreateWorkItemInput {
  readonly ref: ProjectRef;
  readonly typeKey: string;
  readonly title: string;
  readonly description: string;
  readonly acceptanceCriteria: string;
  readonly priority: Priority;
  readonly estimate: number | null;
  readonly parentKey: string | null;
  readonly confidentiality: Confidentiality;
}

/** Hiérarchie résolue. */
interface Hierarchy {
  readonly parentId: string | null;
  readonly ancestors: readonly string[];
}

/** Configuration résolue pour le type demandé. */
interface Setup {
  readonly type: ItemType;
  readonly workflow: WorkflowSnapshot;
  readonly state: SnapshotState;
}

const UNKNOWN_TYPE = domainError('workitem.unknown_type', 'validation', "Ce type d'élément n'existe pas dans le projet.");
const NO_WORKFLOW = domainError('workitem.workflow_not_published', 'conflict', "Aucun workflow publié pour ce type d'élément.");
const PARENT_REQUIRED = domainError('workitem.parent_not_found', 'validation', 'Le parent indiqué est introuvable dans ce projet.');

/**
 * Détermine les ancêtres de l'élément à partir du parent éventuel.
 * @param dependencies dépendances
 * @param context contexte
 * @param request projet, type et parent
 * @returns hiérarchie ou erreur
 */
async function resolveAncestors(dependencies: WorkItemDependencies, context: ExecutionContext, request: { readonly project: ProjectSnapshot; readonly type: ItemType; readonly parentKey: string | null }): Promise<Result<Hierarchy, DomainError>> {
  if (request.parentKey === null) return ok({ parentId: null, ancestors: [] });
  const parent = await loadItem(dependencies, context, { ...READ, ref: { id: request.project.id }, itemRef: request.parentKey });
  if (!parent.ok) return err(PARENT_REQUIRED);
  const ancestors = checkParent(request.type, null, parent.value.item);
  return ancestors.ok ? ok({ parentId: parent.value.item.id, ancestors: ancestors.value }) : ancestors;
}

/**
 * Valide les champs saisis.
 * @param input entrée
 * @returns champs normalisés ou erreur
 */
function validateFields(input: CreateWorkItemInput): Result<{ readonly title: string; readonly estimate: number | null }, DomainError> {
  const title = validateTitle(input.title);
  if (!title.ok) return title;
  const description = validateLongText(input.description, 'description');
  if (!description.ok) return description;
  const criteria = validateLongText(input.acceptanceCriteria, 'criteria');
  if (!criteria.ok) return criteria;
  const estimate = validateEstimate(input.estimate);
  return estimate.ok ? ok({ title: title.value, estimate: estimate.value }) : estimate;
}

/**
 * Résout le type, sa version de workflow publiée et l'état initial.
 * @param dependencies dépendances
 * @param project projet
 * @param typeKey type demandé
 * @returns configuration ou erreur
 */
async function resolveSetup(dependencies: WorkItemDependencies, project: ProjectSnapshot, typeKey: string): Promise<Result<Setup, DomainError>> {
  const type = (await dependencies.configuration.listTypes(project.id)).find((candidate) => candidate.key === typeKey);
  if (type === undefined) return err(UNKNOWN_TYPE);
  const workflow = await dependencies.configuration.currentWorkflow(project.id, type.workflowKey);
  const state = workflow === undefined ? undefined : initialState(workflow);
  return workflow === undefined || state === undefined ? err(NO_WORKFLOW) : ok({ type, workflow, state });
}

/**
 * Canal de création tracé sur l'élément.
 * @param context contexte
 * @returns canal
 */
function channelOf(context: ExecutionContext): CreatedVia {
  if (context.channel === 'ui' || context.channel === 'mcp' || context.channel === 'plugin') return context.channel;
  return 'api';
}

/**
 * Construit le nouvel élément.
 * @param dependencies dépendances
 * @param context contexte
 * @param parts projet, configuration, hiérarchie, champs et entrée
 * @returns élément
 */
async function buildItem(dependencies: WorkItemDependencies, context: ExecutionContext, parts: { readonly project: ProjectSnapshot; readonly setup: Setup; readonly hierarchy: Hierarchy; readonly fields: { readonly title: string; readonly estimate: number | null }; readonly input: CreateWorkItemInput }): Promise<WorkItem> {
  const { project, setup, hierarchy, fields, input } = parts;
  const itemNumber = await dependencies.configuration.nextNumber(project.id);
  return {
    id: dependencies.ids.next(), projectId: project.id, number: itemNumber, key: itemKey(project.key, itemNumber), typeKey: setup.type.key, title: fields.title,
    description: input.description, acceptanceCriteria: input.acceptanceCriteria, stateKey: setup.state.key, stateCategory: setup.state.category, workflowVersionId: setup.workflow.versionId,
    priority: input.priority, parentId: hierarchy.parentId, ancestors: hierarchy.ancestors, assigneeId: null, reporterId: actorUserId(context) ?? null, estimate: fields.estimate,
    rank: rankBetween(await dependencies.items.lastRank(project.id), null), confidentiality: input.confidentiality, createdVia: channelOf(context), createdAt: dependencies.clock.now(),
    resolvedAt: null, deletedAt: null, version: 1,
  };
}

/**
 * Crée un élément de travail.
 * @param dependencies dépendances
 * @param context contexte
 * @param input projet et données de l'élément
 * @returns élément créé
 */
export async function createWorkItem(dependencies: WorkItemDependencies, context: ExecutionContext, input: CreateWorkItemInput): Promise<Result<UseCaseOutput<WorkItem>, DomainError>> {
  const project = await loadProject(dependencies, context, { ref: input.ref, permission: 'work_item:create', risk: 'R1', writable: true });
  if (!project.ok) return project;
  const fields = validateFields(input);
  if (!fields.ok) return fields;
  const setup = await resolveSetup(dependencies, project.value, input.typeKey);
  if (!setup.ok) return setup;
  const hierarchy = await resolveAncestors(dependencies, context, { project: project.value, type: setup.value.type, parentKey: input.parentKey });
  if (!hierarchy.ok) return hierarchy;
  const item = await buildItem(dependencies, context, { project: project.value, setup: setup.value, hierarchy: hierarchy.value, fields: fields.value, input });
  await dependencies.items.insert(item);
  await dependencies.items.appendHistory({ workItemId: item.id, occurredAt: item.createdAt, actorId: item.reporterId, action: 'created', changes: {} });
  return ok({ result: item, events: [itemEvent(WORKITEM_EVENTS.created, item, { workflowKey: setup.value.workflow.workflowKey })] });
}
