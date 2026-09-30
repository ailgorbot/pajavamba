/**
 * Cas d'usage `work_item.create` : création d'un élément dans l'état initial de son workflow.
 *
 * Couche : basse (workitem/fonctionnel). Règles : RG-WI-001, RG-WI-002, RG-WI-003, RG-WI-005,
 * RG-PRJ-004, RG-WI-009 (canal de création tracé).
 */
import { actorUserId, domainError, err, ok, type DomainError, type ExecutionContext, type ProjectRef, type Result, type UseCaseOutput } from '@pajavamba/kernel';
import { checkParent, type ItemType } from '../domaine/hierarchy.ts';
import { rankBetween } from '../domaine/rank.ts';
import { initialState } from '../domaine/transition.ts';
import { itemKey, validateEstimate, validateLongText, validateTitle, type Confidentiality, type CreatedVia, type Priority, type WorkItem } from '../domaine/work-item.ts';
import type { ProjectSnapshot, WorkItemDependencies } from '../ports/workitem.ports.ts';
import { itemEvent, loadItem, loadProject, WORKITEM_EVENTS } from './item-access.ts';

/** Entrée de la création. */
export interface CreateWorkItemInput {
  readonly typeKey: string;
  readonly title: string;
  readonly description: string;
  readonly acceptanceCriteria: string;
  readonly priority: Priority;
  readonly estimate: number | null;
  readonly parentKey: string | null;
  readonly confidentiality: Confidentiality;
}

const UNKNOWN_TYPE = domainError('workitem.unknown_type', 'validation', "Ce type d'élément n'existe pas dans le projet.");
const NO_WORKFLOW = domainError('workitem.workflow_not_published', 'conflict', "Aucun workflow publié pour ce type d'élément.");
const PARENT_REQUIRED = domainError('workitem.parent_not_found', 'validation', 'Le parent indiqué est introuvable dans ce projet.');

/**
 * Détermine les ancêtres de l'élément à partir du parent éventuel.
 * @param dependencies dépendances
 * @param context contexte
 * @param project projet
 * @param type type
 * @param parentKey clé du parent
 * @returns ancêtres ou erreur
 */
async function resolveAncestors(dependencies: WorkItemDependencies, context: ExecutionContext, project: ProjectSnapshot, type: ItemType, parentKey: string | null): Promise<Result<{ readonly parentId: string | null; readonly ancestors: readonly string[] }, DomainError>> {
  if (parentKey === null) return ok({ parentId: null, ancestors: [] });
  const parent = await loadItem(dependencies, context, { id: project.id }, parentKey, { permission: 'work_item:read', risk: 'R0', writable: false });
  if (!parent.ok) return err(PARENT_REQUIRED);
  const ancestors = checkParent(type, null, parent.value.item);
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
 * Crée un élément de travail.
 * @param dependencies dépendances
 * @param context contexte
 * @param ref projet
 * @param input données de l'élément
 * @returns élément créé
 */
export async function createWorkItem(dependencies: WorkItemDependencies, context: ExecutionContext, ref: ProjectRef, input: CreateWorkItemInput): Promise<Result<UseCaseOutput<WorkItem>, DomainError>> {
  const project = await loadProject(dependencies, context, ref, { permission: 'work_item:create', risk: 'R1', writable: true });
  if (!project.ok) return project;
  const fields = validateFields(input);
  if (!fields.ok) return fields;
  const type = (await dependencies.configuration.listTypes(project.value.id)).find((candidate) => candidate.key === input.typeKey);
  if (type === undefined) return err(UNKNOWN_TYPE);
  const workflow = await dependencies.configuration.currentWorkflow(project.value.id, type.workflowKey);
  const state = workflow === undefined ? undefined : initialState(workflow);
  if (workflow === undefined || state === undefined) return err(NO_WORKFLOW);
  const hierarchy = await resolveAncestors(dependencies, context, project.value, type, input.parentKey);
  if (!hierarchy.ok) return hierarchy;
  const itemNumber = await dependencies.configuration.nextNumber(project.value.id);
  const item: WorkItem = {
    id: dependencies.ids.next(), projectId: project.value.id, number: itemNumber, key: itemKey(project.value.key, itemNumber), typeKey: type.key, title: fields.value.title,
    description: input.description, acceptanceCriteria: input.acceptanceCriteria, stateKey: state.key, stateCategory: state.category, workflowVersionId: workflow.versionId,
    priority: input.priority, parentId: hierarchy.value.parentId, ancestors: hierarchy.value.ancestors, assigneeId: null, reporterId: actorUserId(context) ?? null, estimate: fields.value.estimate,
    rank: rankBetween(await dependencies.items.lastRank(project.value.id), null), confidentiality: input.confidentiality, createdVia: context.channel === 'ui' ? 'ui' : channelOf(context), createdAt: dependencies.clock.now(),
    resolvedAt: null, deletedAt: null, version: 1,
  };
  await dependencies.items.insert(item);
  await dependencies.items.appendHistory({ workItemId: item.id, occurredAt: item.createdAt, actorId: item.reporterId, action: 'created', changes: {} });
  return ok({ result: item, events: [itemEvent(WORKITEM_EVENTS.created, item, { workflowKey: workflow.workflowKey })] });
}

/**
 * Canal de création tracé sur l'élément.
 * @param context contexte
 * @returns canal
 */
function channelOf(context: ExecutionContext): CreatedVia {
  return context.channel === 'mcp' || context.channel === 'plugin' ? context.channel : 'api';
}
