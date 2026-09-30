/**
 * Ports et modèles de lecture du service query.
 *
 * Couche : basse (query/fonctionnel). Règles : RI-SRV-07 (vues consolidées inter-contextes servies
 * par query), RI-ARC-10.
 */
import type { AccessPolicy, ProjectId, ProjectRef } from '@pajavamba/kernel';

/** Projet connu de la vue de lecture. */
export interface ProjectView {
  readonly id: ProjectId;
  readonly key: string;
  readonly name: string;
  readonly status: string;
}

/** État d'un workflow, dans l'ordre d'affichage. */
export interface StateView {
  readonly versionId: string;
  readonly workflowKey: string;
  readonly key: string;
  readonly name: string;
  readonly category: 'todo' | 'in_progress' | 'done';
  readonly position: number;
  readonly wipLimit: number | null;
}

/** Élément tel que présenté dans les listes. */
export interface ItemView {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly projectKey: string;
  readonly key: string;
  readonly typeKey: string;
  readonly title: string;
  readonly stateKey: string;
  readonly stateName: string;
  readonly stateCategory: 'todo' | 'in_progress' | 'done';
  readonly workflowKey: string;
  readonly priority: string;
  readonly parentId: string | null;
  readonly assigneeId: string | null;
  readonly estimate: number | null;
  readonly rank: string;
  readonly confidentiality: 'normal' | 'restricted';
}

/** Entrée du journal d'activité (identifiants et valeurs énumérées uniquement). */
export interface ActivityView {
  readonly occurredAt: string;
  readonly eventCode: string;
  readonly resourceKey: string | null;
  readonly actorId: string | null;
  readonly params: Readonly<Record<string, string | number | boolean | null>>;
}

/** Filtre d'éléments. */
export interface ItemFilter {
  readonly projectIds: readonly ProjectId[] | 'all';
  readonly includeRestricted: boolean;
  readonly includeDone: boolean;
  readonly typeKey: string | null;
  readonly workflowKey: string | null;
  readonly text: string | null;
  readonly limit: number;
}

/** Dépôt des vues de lecture. */
export interface QueryRepository {
  findProject(ref: ProjectRef): Promise<ProjectView | undefined>;
  latestStates(projectId: ProjectId, workflowKey: string): Promise<readonly StateView[]>;
  workflowKeys(projectId: ProjectId): Promise<readonly string[]>;
  listItems(filter: ItemFilter): Promise<readonly ItemView[]>;
  listActivity(projectId: ProjectId, limit: number): Promise<readonly ActivityView[]>;
}

/** Dépendances des cas d'usage query. */
export interface QueryDependencies {
  readonly views: QueryRepository;
  readonly policy: AccessPolicy;
}
