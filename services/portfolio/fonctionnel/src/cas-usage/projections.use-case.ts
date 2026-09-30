/**
 * Réactions de portfolio aux événements d'autres services : configuration prête (workflow),
 * compteur d'éléments non terminés (workitem) utilisé par l'assistant de clôture.
 *
 * Couche : basse (portfolio/fonctionnel). Règles : RG-PRJ-005, RI-SRV-04 (saga), RI-SRV-11.
 */
import type { ProjectId } from '@pajavamba/kernel';
import type { PortfolioDependencies } from '../ports/portfolio.ports.ts';

/**
 * Marque la configuration méthodologique du projet comme prête.
 * @param dependencies dépendances
 * @param projectId projet
 */
export async function markConfigurationReady(dependencies: PortfolioDependencies, projectId: ProjectId): Promise<void> {
  await dependencies.projects.updateDerived(projectId, { configurationReady: true });
}

/**
 * Ajuste le nombre d'éléments non terminés d'un projet.
 * @param dependencies dépendances
 * @param projectId projet
 * @param delta variation (+1, -1)
 */
export async function adjustOpenItems(dependencies: PortfolioDependencies, projectId: ProjectId, delta: number): Promise<void> {
  if (delta === 0) return;
  await dependencies.projects.updateDerived(projectId, { openItemDelta: delta });
}

/**
 * Variation du nombre d'éléments ouverts pour un changement de catégorie d'état.
 * @param from catégorie avant (`null` à la création)
 * @param to catégorie après (`null` à la suppression)
 * @returns variation
 */
export function openItemDelta(from: string | null, to: string | null): number {
  const isOpen = (category: string | null): number => (category !== null && category !== 'done' ? 1 : 0);
  return isOpen(to) - isOpen(from);
}
