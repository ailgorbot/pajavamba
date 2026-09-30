/**
 * Cas d'usage des projets : création, modification, lecture, liste.
 *
 * Couche : basse (portfolio/fonctionnel). Règles : RG-PRJ-001, RG-PRJ-002, RG-PRJ-004, §2.4 (création
 * en brouillon), RI-SEC-03.
 */
import { actorUserId, domainError, err, ok, requireAccess, toEntityId, type DomainError, type ExecutionContext, type Result, type UseCaseOutput } from '@pajavamba/kernel';
import { PORTFOLIO_EVENTS, projectEvent } from '../domaine/portfolio.events.ts';
import { validateProjectKey, validateProjectName, validateText, type MethodologyPackKey, type Project, type ProjectVisibility } from '../domaine/project.ts';
import type { PortfolioDependencies } from '../ports/portfolio.ports.ts';
import { loadProject, type ProjectRef } from './project-access.ts';

/** Entrée de la création d'un projet. */
export interface CreateProjectInput {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly visibility: ProjectVisibility;
  readonly methodologyPackKey: MethodologyPackKey;
  readonly timeZone: string;
}

const KEY_TAKEN = domainError('portfolio.key_taken', 'conflict', 'Cette clé de projet est déjà utilisée dans votre organisation.');

/**
 * Crée un projet en brouillon (`project.create`).
 * @param dependencies dépendances
 * @param context contexte
 * @param input données du projet
 * @returns projet créé
 */
export async function createProject(dependencies: PortfolioDependencies, context: ExecutionContext, input: CreateProjectInput): Promise<Result<UseCaseOutput<Project>, DomainError>> {
  const access = await requireAccess(dependencies.policy, context, { permission: 'project:create', risk: 'R1' });
  if (!access.ok) return access;
  const key = validateProjectKey(input.key);
  if (!key.ok) return key;
  const name = validateProjectName(input.name);
  if (!name.ok) return name;
  const description = validateText(input.description, false);
  if (!description.ok) return description;
  if ((await dependencies.projects.findByKey(key.value)) !== undefined) return err(KEY_TAKEN);
  const project: Project = {
    id: toEntityId(dependencies.ids.next()), organisationId: context.organisationId, key: key.value, name: name.value, description: description.value,
    status: 'draft', visibility: input.visibility, methodologyPackKey: input.methodologyPackKey, timeZone: input.timeZone, configurationReady: false, openItemCount: 0,
    createdBy: actorUserId(context) ?? null, closedAt: null, closureSummary: null, archivedAt: null, deletionScheduledFor: null, deletionFromStatus: null, version: 1,
  };
  await dependencies.projects.insert(project);
  return ok({ result: project, events: [projectEvent(PORTFOLIO_EVENTS.projectCreated, project, { timeZone: project.timeZone })] });
}

/** Modification d'un projet. */
export interface UpdateProjectInput {
  readonly name?: string;
  readonly description?: string;
  readonly visibility?: ProjectVisibility;
}

/**
 * Modifie les informations d'un projet (`project.update`) ; la clé est immuable (RG-PRJ-001).
 * @param dependencies dépendances
 * @param context contexte
 * @param ref projet
 * @param input champs modifiés
 * @returns projet modifié
 */
export async function updateProject(dependencies: PortfolioDependencies, context: ExecutionContext, ref: ProjectRef, input: UpdateProjectInput): Promise<Result<UseCaseOutput<Project>, DomainError>> {
  const loaded = await loadProject(dependencies, context, ref, { permission: 'project:update', risk: 'R1', writable: true });
  if (!loaded.ok) return loaded;
  const name = input.name === undefined ? ok(loaded.value.name) : validateProjectName(input.name);
  if (!name.ok) return name;
  const description = input.description === undefined ? ok(loaded.value.description) : validateText(input.description, false);
  if (!description.ok) return description;
  const updated: Project = { ...loaded.value, name: name.value, description: description.value, visibility: input.visibility ?? loaded.value.visibility, version: loaded.value.version + 1 };
  await dependencies.projects.update(updated);
  return ok({ result: updated, events: [projectEvent(PORTFOLIO_EVENTS.projectUpdated, updated, { fields: Object.keys(input) })] });
}

/**
 * Lit un projet visible (`project.get`).
 * @param dependencies dépendances
 * @param context contexte
 * @param ref projet
 * @returns projet
 */
export async function getProject(dependencies: PortfolioDependencies, context: ExecutionContext, ref: ProjectRef): Promise<Result<Project, DomainError>> {
  return loadProject(dependencies, context, ref, { permission: 'project:read', risk: 'R0', writable: false });
}

/**
 * Liste les projets visibles par l'acteur (`project.list`) ; les archivés sont masqués par défaut.
 * @param dependencies dépendances
 * @param context contexte
 * @param includeArchived inclure les projets archivés
 * @returns projets
 */
export async function listProjects(dependencies: PortfolioDependencies, context: ExecutionContext, includeArchived: boolean): Promise<readonly Project[]> {
  const scope = await dependencies.policy.projectsWith(context, 'project:read');
  return dependencies.projects.list({ projectIds: scope.all ? 'all' : scope.projectIds, includeArchived });
}
