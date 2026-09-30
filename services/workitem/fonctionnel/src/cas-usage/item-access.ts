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

/** Demande d'accès à un projet. */
export interface ProjectAccess extends Requirement {
  readonly ref: ProjectRef;
}

/** Demande d'accès à un élément (clé ou identifiant). */
export interface ItemAccess extends ProjectAccess {
  readonly itemRef: string;
  readonly includeDeleted?: boolean;
}

/** Désignation d'un élément dans un projet. */
export interface ItemTarget {
  readonly ref: ProjectRef;
  readonly itemRef: string;
}

/** Projet et élément chargés. */
export interface LoadedItem {
  readonly project: ProjectSnapshot;
  readonly item: WorkItem;
}

/** Exigence de lecture. */
export const READ: Requirement = { permission: 'work_item:read', risk: 'R0', writable: false };

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
 * @param access projet et exigence
 * @returns projet ou erreur
 */
export async function loadProject(dependencies: WorkItemDependencies, context: ExecutionContext, access: ProjectAccess): Promise<Result<ProjectSnapshot, DomainError>> {
  const project = await dependencies.configuration.findProject(access.ref);
  if (project === undefined) return err(NOT_FOUND);
  if (!(await requireAccess(dependencies.policy, context, { permission: 'work_item:read', risk: 'R0', projectId: project.id })).ok) return err(NOT_FOUND);
  if (!(await requireAccess(dependencies.policy, context, { permission: access.permission, risk: access.risk, projectId: project.id })).ok) return err(FORBIDDEN);
  return access.writable && !WRITABLE_STATUSES.has(project.status) ? err(PROJECT_READ_ONLY) : ok(project);
}

/**
 * Indique si l'acteur peut voir un élément (confidentialité, corbeille).
 * @param dependencies dépendances
 * @param context contexte
 * @param loaded projet, élément et option de corbeille
 * @returns vrai si l'élément est visible
 */
async function isVisible(dependencies: WorkItemDependencies, context: ExecutionContext, loaded: LoadedItem & { readonly includeDeleted: boolean }): Promise<boolean> {
  if (loaded.item.projectId !== loaded.project.id || (loaded.item.deletedAt !== null && !loaded.includeDeleted)) return false;
  if (loaded.item.confidentiality === 'normal') return true;
  return (await requireAccess(dependencies.policy, context, { permission: 'work_item:read_restricted', risk: 'R0', projectId: loaded.project.id })).ok;
}

/**
 * Charge un élément (par clé ou identifiant) visible par l'acteur.
 * @param dependencies dépendances
 * @param context contexte
 * @param access projet, élément et exigence
 * @returns projet et élément, ou erreur
 */
export async function loadItem(dependencies: WorkItemDependencies, context: ExecutionContext, access: ItemAccess): Promise<Result<LoadedItem, DomainError>> {
  const project = await loadProject(dependencies, context, access);
  if (!project.ok) return project;
  const item = isUuid(access.itemRef) ? await dependencies.items.findById(access.itemRef) : await dependencies.items.findByKey(access.itemRef);
  if (item === undefined) return err(ITEM_NOT_FOUND);
  const visible = await isVisible(dependencies, context, { project: project.value, item, includeDeleted: access.includeDeleted === true });
  return visible ? ok({ project: project.value, item }) : err(ITEM_NOT_FOUND);
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
