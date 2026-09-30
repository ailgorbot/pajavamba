/**
 * Ports requis par les cas d'usage du service workitem.
 *
 * Couche : basse (workitem/fonctionnel). Règles : RI-ARC-08, RI-ARC-10.
 */
import type { AccessPolicy, Clock, IdGenerator, ProjectId, ProjectRef, UserId } from '@pajavamba/kernel';
import type { ItemType } from '../domaine/hierarchy.ts';
import type { WorkflowSnapshot } from '../domaine/transition.ts';
import type { WorkItem } from '../domaine/work-item.ts';

/** Projection locale d'un projet (source : portfolio). */
export interface ProjectSnapshot {
  readonly id: ProjectId;
  readonly key: string;
  readonly status: string;
}

/** Commentaire. */
export interface Comment {
  readonly id: string;
  readonly workItemId: string;
  readonly authorId: UserId | null;
  readonly body: string;
  readonly createdVia: string;
  readonly createdAt: number;
}

/** Entrée d'historique : noms des champs modifiés et valeurs non personnelles. */
export interface HistoryEntry {
  readonly workItemId: string;
  readonly occurredAt: number;
  readonly actorId: UserId | null;
  readonly action: string;
  readonly changes: Readonly<Record<string, { readonly from: string | null; readonly to: string | null }>>;
}

/** Dépôt de la configuration du projet (projets, types, workflows publiés). */
export interface ConfigurationRepository {
  findProject(ref: ProjectRef): Promise<ProjectSnapshot | undefined>;
  upsertProject(project: ProjectSnapshot): Promise<void>;
  deleteProject(id: ProjectId): Promise<void>;
  /** Réserve le prochain numéro d'élément du projet (jamais réutilisé, RG-WI-001). */
  nextNumber(projectId: ProjectId): Promise<number>;
  listTypes(projectId: ProjectId): Promise<readonly ItemType[]>;
  replaceTypes(projectId: ProjectId, types: readonly ItemType[]): Promise<void>;
  /** Version publiée courante d'un workflow du projet. */
  currentWorkflow(projectId: ProjectId, workflowKey: string): Promise<WorkflowSnapshot | undefined>;
  findWorkflowVersion(versionId: string): Promise<WorkflowSnapshot | undefined>;
  saveWorkflowVersion(projectId: ProjectId, snapshot: WorkflowSnapshot): Promise<void>;
}

/** Dépôt des éléments, commentaires et historique. */
export interface WorkItemRepository {
  findById(id: string): Promise<WorkItem | undefined>;
  findByKey(key: string): Promise<WorkItem | undefined>;
  insert(item: WorkItem): Promise<void>;
  /** Met à jour avec verrouillage optimiste (version précédente = version - 1). */
  update(item: WorkItem): Promise<void>;
  lastRank(projectId: ProjectId): Promise<string | null>;
  /** Rang de la cible et de l'élément qui la précède, l'élément déplacé exclu. */
  neighbourRanks(projectId: ProjectId, targetId: string, movingId: string): Promise<{ readonly before: string | null; readonly target: string } | undefined>;
  countOpenChildren(parentId: string): Promise<number>;
  countInState(projectId: ProjectId, stateKey: string, workflowKey: string): Promise<number>;
  insertComment(comment: Comment): Promise<void>;
  listComments(workItemId: string): Promise<readonly Comment[]>;
  appendHistory(entry: HistoryEntry): Promise<void>;
  listHistory(workItemId: string): Promise<readonly HistoryEntry[]>;
  listChildren(parentId: string): Promise<readonly WorkItem[]>;
}

/** Dépendances des cas d'usage workitem. */
export interface WorkItemDependencies {
  readonly configuration: ConfigurationRepository;
  readonly items: WorkItemRepository;
  readonly policy: AccessPolicy;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}
