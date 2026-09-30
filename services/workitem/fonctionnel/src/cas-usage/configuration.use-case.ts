/**
 * Réactions de workitem aux événements de configuration : projets (portfolio), types et versions
 * de workflow publiées (workflow).
 *
 * Couche : basse (workitem/fonctionnel). Règles : RI-SRV-04 (saga), RG-WF-001 (instantanés
 * immuables), RI-MET-04.
 */
import type { ProjectId } from '@pajavamba/kernel';
import type { ItemType } from '../domaine/hierarchy.ts';
import type { WorkflowSnapshot } from '../domaine/transition.ts';
import type { ProjectSnapshot, WorkItemDependencies } from '../ports/workitem.ports.ts';

/**
 * Enregistre ou met à jour la projection d'un projet.
 * @param dependencies dépendances
 * @param project projet
 */
export async function recordProject(dependencies: WorkItemDependencies, project: ProjectSnapshot): Promise<void> {
  await dependencies.configuration.upsertProject(project);
}

/**
 * Enregistre la configuration issue d'un pack : types et versions publiées.
 * @param dependencies dépendances
 * @param projectId projet
 * @param pack types d'éléments et versions publiées
 */
export async function recordPack(dependencies: WorkItemDependencies, projectId: ProjectId, pack: { readonly types: readonly ItemType[]; readonly workflows: readonly WorkflowSnapshot[] }): Promise<void> {
  await dependencies.configuration.replaceTypes(projectId, pack.types);
  for (const snapshot of pack.workflows) {
    await dependencies.configuration.saveWorkflowVersion(projectId, snapshot);
  }
}

/**
 * Enregistre une nouvelle version publiée (les éléments existants restent sur leur version).
 * @param dependencies dépendances
 * @param projectId projet
 * @param snapshot version publiée
 */
export async function recordWorkflowVersion(dependencies: WorkItemDependencies, projectId: ProjectId, snapshot: WorkflowSnapshot): Promise<void> {
  await dependencies.configuration.saveWorkflowVersion(projectId, snapshot);
}
