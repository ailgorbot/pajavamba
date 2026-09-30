/**
 * Chargement d'un projet sous contrôle des droits.
 *
 * Couche : basse (portfolio/fonctionnel). Règles : RI-SEC-03 (projet inaccessible = inexistant),
 * RI-ARC-10, RG-PRJ-004.
 */
import { err, FORBIDDEN, NOT_FOUND, ok, requireAccess, type DomainError, type ExecutionContext, type ProjectRef, type Result, type RiskLevel } from '@pajavamba/kernel';

export type { ProjectRef } from '@pajavamba/kernel';
import { isReadOnly, READ_ONLY, type Project } from '../domaine/project.ts';
import type { PortfolioDependencies } from '../ports/portfolio.ports.ts';


/** Exigence d'accès au projet. */
export interface ProjectAccess {
  readonly permission: string;
  readonly risk: RiskLevel;
  /** Refuse l'action si le projet est en lecture seule. */
  readonly writable: boolean;
}

/**
 * Charge un projet visible par l'acteur puis vérifie la permission demandée.
 * @param dependencies dépendances
 * @param context contexte
 * @param ref référence du projet
 * @param access exigence
 * @returns projet ou erreur
 */
export async function loadProject(dependencies: PortfolioDependencies, context: ExecutionContext, ref: ProjectRef, access: ProjectAccess): Promise<Result<Project, DomainError>> {
  const project = 'id' in ref ? await dependencies.projects.findById(ref.id) : await dependencies.projects.findByKey(ref.key);
  if (project === undefined) return err(NOT_FOUND);
  const visible = await requireAccess(dependencies.policy, context, { permission: 'project:read', risk: 'R0', projectId: project.id });
  if (!visible.ok) return err(NOT_FOUND);
  const allowed = await requireAccess(dependencies.policy, context, { permission: access.permission, risk: access.risk, projectId: project.id });
  if (!allowed.ok) return err(FORBIDDEN);
  if (access.writable && isReadOnly(project)) return err(READ_ONLY);
  return ok(project);
}
