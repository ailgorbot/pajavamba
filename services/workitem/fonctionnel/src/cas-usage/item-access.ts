/**
 * Chargement d'un projet ou d'un élément sous contrôle des droits, et événements d'élément.
 *
 * Couche : basse (workitem/fonctionnel). Règles : RI-SEC-03, RG-WI-007 (élément confidentiel
 * invisible sans `work_item:read_restricted`), RG-PRJ-004, RI-MET-06.
 */
import { domainError, err, FORBIDDEN, isUuid, NOT_FOUND, ok, requireAccess, type DomainError, type DomainEvent, type ExecutionContext, type ProjectRef, type Result, type RiskLevel } from '@pajavamba/kernel';
import { ITEM_NOT_FOUND, type WorkItem } from '../domaine/work-item.ts';
import type { ProjectSnapshot, WorkItemDependencies } from '../ports/workitem.ports.ts';

/** Exigence d'accès. */
export interface Requirement {
  readonly permission: string;
  readonly risk: RiskLevel;
  readonly writable: boolean;
}

/** Types d'événements publiés par workitem. */
export const WORKITEM_EVENTS = {
  created: 'pv.workitem.work_item.created.v1',
  updated: 'pv.workitem.work_item.updated.v1',
  transitioned: 'pv.workitem.work_item.transitioned.v1',
  assigned: 'pv.workitem.work_item.assigned.v1',
  ranked: 'pv.workitem.work_item.ranked.v1',
  deleted: 'pv.workitem.work_item.deleted.v1',
  restored: 'pv.workitem.work_item.restored.v1',
  commentAdded: 'pv.workitem.comment.added.v1',
} as const;

const PROJECT_READ_ONLY = domainError('workitem.project_read_only', 'conflict', 'Ce projet est clôturé, archivé ou en suppression programmée : il est en lecture seule.');
const WRITABLE_STATUSES = new Set(['draft', 'active']);

/**
 * Charge un projet visible et vérifie une permission.
 * @param dependencies dépendances
 * @param context contexte
 * @param ref projet
 * @param requirement exigence
 * @returns projet ou erreur
 */
export async function loadProject(dependencies: WorkItemDependencies, context: ExecutionContext, ref: ProjectRef, requirement: Requirement): Promise<Result<ProjectSnapshot, DomainError>> {
  const project = await dependencies.configuration.findProject(ref);
  if (project === undefined) return err(NOT_FOUND);
  if (!(await requireAccess(dependencies.policy, context, { permission: 'work_item:read', risk: 'R0', projectId: project.id })).ok) return err(NOT_FOUND);
  if (!(await requireAccess(dependencies.policy, context, { permission: requirement.permission, risk: requirement.risk, projectId: project.id })).ok) return err(FORBIDDEN);
  return requirement.writable && !WRITABLE_STATUSES.has(project.status) ? err(PROJECT_READ_ONLY) : ok(project);
}

/**
 * Charge un élément (par clé ou identifiant) visible par l'acteur.
 * @param dependencies dépendances
 * @param context contexte
 * @param ref projet
 * @param itemRef clé ou identifiant de l'élément
 * @param requirement exigence
 * @returns projet et élément, ou erreur
 */
export async function loadItem(dependencies: WorkItemDependencies, context: ExecutionContext, ref: ProjectRef, itemRef: string, requirement: Requirement & { readonly includeDeleted?: boolean }): Promise<Result<{ readonly project: ProjectSnapshot; readonly item: WorkItem }, DomainError>> {
  const project = await loadProject(dependencies, context, ref, requirement);
  if (!project.ok) return project;
  const item = isUuid(itemRef) ? await dependencies.items.findById(itemRef) : await dependencies.items.findByKey(itemRef);
  if (item?.projectId !== project.value.id || (item.deletedAt !== null && requirement.includeDeleted !== true)) return err(ITEM_NOT_FOUND);
  if (item.confidentiality === 'restricted' && !(await requireAccess(dependencies.policy, context, { permission: 'work_item:read_restricted', risk: 'R0', projectId: project.value.id })).ok) return err(ITEM_NOT_FOUND);
  return ok({ project: project.value, item });
}

/**
 * Événement d'élément portant l'instantané utile aux vues de lecture internes (`query`).
 * @param type type d'événement
 * @param item élément après changement
 * @param extra données complémentaires
 * @returns événement
 */
export function itemEvent(type: string, item: WorkItem, extra: Readonly<Record<string, string | number | null>> = {}): DomainEvent {
  return {
    type,
    aggregateId: item.id,
    aggregateVersion: item.version,
    data: {
      projectId: item.projectId, key: item.key, number: item.number, typeKey: item.typeKey, title: item.title, stateKey: item.stateKey, stateCategory: item.stateCategory,
      workflowVersionId: item.workflowVersionId, priority: item.priority, parentId: item.parentId, assigneeId: item.assigneeId, estimate: item.estimate, rank: item.rank,
      confidentiality: item.confidentiality, deleted: item.deletedAt !== null, ...extra,
    },
  };
}
