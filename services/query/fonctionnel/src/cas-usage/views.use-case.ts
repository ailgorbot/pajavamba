/**
 * Cas d'usage de lecture consolidée : backlog, board, recherche, journal d'activité.
 *
 * Couche : basse (query/fonctionnel). Règles : RG-WI-007 (éléments confidentiels filtrés),
 * RI-SEC-03, RI-API-03 (listes bornées), RG-WF-004 (dépassement WIP signalé), RI-MET-07.
 */
import { err, NOT_FOUND, ok, requireAccess, type DomainError, type ExecutionContext, type ProjectRef, type Result } from '@pajavamba/kernel';
import type { ActivityView, ItemView, ProjectView, QueryDependencies, StateView } from '../ports/query.ports.ts';

/** Nombre maximal d'éléments renvoyés par une liste (RI-API-03). */
export const MAX_LIST = 200;
/** Nombre maximal de cartes d'un board (EXG-PERF-003). */
export const MAX_BOARD = 500;

/** Options du backlog. */
export interface BacklogOptions {
  readonly includeDone: boolean;
  readonly typeKey: string | null;
  readonly text: string | null;
}

/**
 * Charge un projet dont l'acteur peut lire les éléments.
 * @param dependencies dépendances
 * @param context contexte
 * @param ref projet
 * @returns projet et accès aux éléments confidentiels
 */
async function readableProject(dependencies: QueryDependencies, context: ExecutionContext, ref: ProjectRef): Promise<Result<{ readonly project: ProjectView; readonly restricted: boolean }, DomainError>> {
  const project = await dependencies.views.findProject(ref);
  if (project === undefined) return err(NOT_FOUND);
  if (!(await requireAccess(dependencies.policy, context, { permission: 'work_item:read', risk: 'R0', projectId: project.id })).ok) return err(NOT_FOUND);
  const restricted = (await requireAccess(dependencies.policy, context, { permission: 'work_item:read_restricted', risk: 'R0', projectId: project.id })).ok;
  return ok({ project, restricted });
}

/**
 * Backlog ordonné d'un projet.
 * @param dependencies dépendances
 * @param context contexte
 * @param ref projet
 * @param options filtres
 * @returns projet et éléments
 */
export async function backlog(dependencies: QueryDependencies, context: ExecutionContext, ref: ProjectRef, options: BacklogOptions): Promise<Result<{ readonly project: ProjectView; readonly items: readonly ItemView[] }, DomainError>> {
  const readable = await readableProject(dependencies, context, ref);
  if (!readable.ok) return readable;
  const items = await dependencies.views.listItems({ projectIds: [readable.value.project.id], includeRestricted: readable.value.restricted, includeDone: options.includeDone, typeKey: options.typeKey, workflowKey: null, text: options.text, limit: MAX_LIST });
  return ok({ project: readable.value.project, items });
}

/** Colonne d'un board. */
export interface BoardColumn {
  readonly state: StateView;
  readonly items: readonly ItemView[];
  readonly overWipLimit: boolean;
}

/**
 * Board d'un projet : une colonne par état du workflow choisi, dans l'ordre du workflow.
 * @param dependencies dépendances
 * @param context contexte
 * @param ref projet
 * @param workflowKey workflow affiché (par défaut le premier disponible)
 * @returns projet, workflows disponibles et colonnes
 */
export async function board(dependencies: QueryDependencies, context: ExecutionContext, ref: ProjectRef, workflowKey: string | null): Promise<Result<{ readonly project: ProjectView; readonly workflowKeys: readonly string[]; readonly workflowKey: string | null; readonly columns: readonly BoardColumn[] }, DomainError>> {
  const readable = await readableProject(dependencies, context, ref);
  if (!readable.ok) return readable;
  const { project, restricted } = readable.value;
  const keys = await dependencies.views.workflowKeys(project.id);
  const selected = workflowKey !== null && keys.includes(workflowKey) ? workflowKey : (keys.includes('team_item') ? 'team_item' : keys[0] ?? null);
  if (selected === null) return ok({ project, workflowKeys: keys, workflowKey: null, columns: [] });
  const states = await dependencies.views.latestStates(project.id, selected);
  const items = await dependencies.views.listItems({ projectIds: [project.id], includeRestricted: restricted, includeDone: true, typeKey: null, workflowKey: selected, text: null, limit: MAX_BOARD });
  const columns = states.map((state) => {
    const cards = items.filter((item) => item.stateKey === state.key);
    return { state, items: cards, overWipLimit: state.wipLimit !== null && cards.length > state.wipLimit };
  });
  return ok({ project, workflowKeys: keys, workflowKey: selected, columns });
}

/**
 * Recherche plein texte (français) dans les projets accessibles.
 * @param dependencies dépendances
 * @param context contexte
 * @param text texte recherché
 * @returns éléments trouvés
 */
export async function search(dependencies: QueryDependencies, context: ExecutionContext, text: string): Promise<readonly ItemView[]> {
  const readable = await dependencies.policy.projectsWith(context, 'work_item:read');
  const restricted = await dependencies.policy.projectsWith(context, 'work_item:read_restricted');
  const projectIds = readable.all ? 'all' : readable.projectIds;
  const items = await dependencies.views.listItems({ projectIds, includeRestricted: true, includeDone: true, typeKey: null, workflowKey: null, text, limit: MAX_LIST });
  return items.filter((item) => item.confidentiality === 'normal' || restricted.all || restricted.projectIds.includes(item.projectId));
}

/**
 * Journal d'activité fonctionnel d'un projet.
 * @param dependencies dépendances
 * @param context contexte
 * @param ref projet
 * @returns entrées récentes
 */
export async function activity(dependencies: QueryDependencies, context: ExecutionContext, ref: ProjectRef): Promise<Result<readonly ActivityView[], DomainError>> {
  const project = await dependencies.views.findProject(ref);
  if (project === undefined) return err(NOT_FOUND);
  if (!(await requireAccess(dependencies.policy, context, { permission: 'log:read_functional', risk: 'R0', projectId: project.id })).ok) return err(NOT_FOUND);
  return ok(await dependencies.views.listActivity(project.id, MAX_LIST));
}
