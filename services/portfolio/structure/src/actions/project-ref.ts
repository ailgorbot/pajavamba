/**
 * Résolution de `{projectRef}` : identifiant public (base58), UUID ou clé de projet (§10.3).
 *
 * Couche : moyenne (portfolio/structure). Règle : RI-SEC-03 (référence invalide = 404).
 */
import { parseProjectRef, uuidToPublicId } from '@pajavamba/kernel';
import { HttpProblem } from '@pajavamba/ops';
import type { Project, ProjectRef } from '@pajavamba/portfolio-fonctionnel';

/** Problème de projet introuvable. */
export const PROJECT_NOT_FOUND = new HttpProblem({ status: 404, code: 'access.not_found', title: 'Ressource introuvable', detail: "La ressource demandée n'existe pas ou n'est pas accessible." });

/**
 * Convertit un paramètre `projectRef`.
 * @param value paramètre de chemin
 * @returns référence de projet
 */
export function projectRefOf(value: string | undefined): ProjectRef {
  const ref = parseProjectRef(value);
  if (ref === undefined) throw PROJECT_NOT_FOUND;
  return ref;
}

/**
 * Représentation API d'un projet.
 * @param project projet
 * @returns corps JSON
 */
export function projectBody(project: Project): Record<string, unknown> {
  const iso = (value: number | null): string | null => (value === null ? null : new Date(value).toISOString());
  return {
    id: uuidToPublicId(project.id),
    uuid: project.id,
    key: project.key,
    name: project.name,
    description: project.description,
    status: project.status,
    visibility: project.visibility,
    methodologyPackKey: project.methodologyPackKey,
    timeZone: project.timeZone,
    configurationReady: project.configurationReady,
    openItemCount: project.openItemCount,
    closedAt: iso(project.closedAt),
    closureSummary: project.closureSummary,
    archivedAt: iso(project.archivedAt),
    deletionScheduledFor: iso(project.deletionScheduledFor),
    version: project.version,
  };
}
