/**
 * Ports requis par les cas d'usage du service workflow.
 *
 * Couche : basse (workflow/fonctionnel). Règles : RI-ARC-08, RI-ARC-10.
 */
import type { AccessPolicy, Clock, IdGenerator, ProjectId } from '@pajavamba/kernel';
import type { Workflow, WorkflowVersion } from '../domaine/workflow.ts';

/** Projection locale d'un projet (source : portfolio). */
export interface ProjectSnapshot {
  readonly id: ProjectId;
  readonly key: string;
  readonly status: string;
  readonly packKey: string;
}

/** Dépôt des workflows, versions et projets connus. */
export interface WorkflowRepository {
  findProject(ref: { readonly id: ProjectId } | { readonly key: string }): Promise<ProjectSnapshot | undefined>;
  upsertProject(project: ProjectSnapshot): Promise<void>;
  deleteProject(id: ProjectId): Promise<void>;
  findWorkflow(projectId: ProjectId, key: string): Promise<Workflow | undefined>;
  listWorkflows(projectId: ProjectId): Promise<readonly { readonly workflow: Workflow; readonly versions: readonly WorkflowVersion[] }[]>;
  insertWorkflow(workflow: Workflow): Promise<void>;
  findVersion(id: string): Promise<WorkflowVersion | undefined>;
  latestVersionNumber(workflowId: string): Promise<number>;
  insertVersion(version: WorkflowVersion): Promise<void>;
  /** Seule une version brouillon peut être mise à jour (RG-WF-001). */
  updateDraft(version: WorkflowVersion): Promise<void>;
}

/** Dépendances des cas d'usage workflow. */
export interface WorkflowDependencies {
  readonly workflows: WorkflowRepository;
  readonly policy: AccessPolicy;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}
