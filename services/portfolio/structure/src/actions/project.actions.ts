/**
 * Actions des projets : liste, création, lecture, modification, cycle de vie, assistant de clôture.
 *
 * Couche : moyenne (portfolio/structure). Règles : RI-API-01, RI-API-05 (`If-Match` sur PATCH),
 * RG-PRJ-001 à RG-PRJ-007.
 */
import { defineAction, type ActionCall, type ActionResponse, type RegisteredAction } from '@pajavamba/contracts';
import { ok, type ExecutionContext } from '@pajavamba/kernel';
import { checkIfMatch, parseInput, requireContext, serviceRead, serviceWrite, type ServiceRuntimeShape } from '@pajavamba/ops';
import { changeLifecycle, closureBlockers, createProject, getProject, listProjects, METHODOLOGY_PACKS, updateProject, type LifecycleAction, type PortfolioDependencies, type Project } from '@pajavamba/portfolio-fonctionnel';
import { z } from 'zod';
import type { PortfolioRuntime } from '../composition/portfolio-runtime.ts';
import { projectBody, projectRefOf } from './project-ref.ts';

const CreateInput = z.strictObject({
  key: z.string().max(10).describe('Clé unique et immuable (ex. PAJA)'),
  name: z.string().max(120).describe('Nom du projet'),
  description: z.string().max(10_000).default('').describe('Présentation (Markdown)'),
  visibility: z.enum(['private', 'internal', 'public']).default('private').describe('Visibilité'),
  methodologyPackKey: z.enum(METHODOLOGY_PACKS).describe('Modèle méthodologique'),
  timeZone: z.string().min(1).max(64).default('Europe/Paris').describe('Fuseau IANA'),
});
const UpdateInput = z.strictObject({
  name: z.string().max(120).optional().describe('Nom'),
  description: z.string().max(10_000).optional().describe('Présentation (Markdown)'),
  visibility: z.enum(['private', 'internal', 'public']).optional().describe('Visibilité'),
});
const TextInput = z.strictObject({ text: z.string().max(10_000).default('').describe('Bilan de clôture ou justification') });

interface LifecycleDeclaration {
  readonly action: LifecycleAction;
  readonly path: string;
  readonly permission: 'project:activate' | 'project:close' | 'project:reopen' | 'project:archive' | 'project:unarchive' | 'project:delete';
  readonly risk: 'R1' | 'R2' | 'R3';
  readonly description: string;
}

const LIFECYCLE: readonly LifecycleDeclaration[] = [
  { action: 'activate', path: 'activate', permission: 'project:activate', risk: 'R1', description: 'Active un projet en brouillon.' },
  { action: 'close', path: 'close', permission: 'project:close', risk: 'R2', description: 'Clôture un projet (bilan obligatoire, aucune clôture forcée).' },
  { action: 'reopen', path: 'reopen', permission: 'project:reopen', risk: 'R2', description: 'Rouvre un projet clôturé depuis moins de 90 jours.' },
  { action: 'archive', path: 'archive', permission: 'project:archive', risk: 'R2', description: 'Archive un projet clôturé.' },
  { action: 'unarchive', path: 'unarchive', permission: 'project:unarchive', risk: 'R3', description: 'Désarchive un projet.' },
  { action: 'request_deletion', path: 'request-deletion', permission: 'project:delete', risk: 'R3', description: 'Programme la suppression (30 jours ; 7 jours pour un brouillon).' },
  { action: 'cancel_deletion', path: 'cancel-deletion', permission: 'project:delete', risk: 'R3', description: 'Annule une suppression programmée.' },
];

/**
 * Réponse d'un projet avec son ETag.
 * @param project projet
 * @param status statut HTTP
 * @returns réponse
 */
function projectResponse(project: Project, status: number): ActionResponse {
  return { status, body: projectBody(project), etag: project.version };
}

/**
 * Exécute une écriture sur un projet.
 * @param runtime environnement
 * @param call appel
 * @param spec action, champs modifiés et cas d'usage
 * @returns réponse
 */
async function projectWrite(runtime: PortfolioRuntime, call: ActionCall, spec: { readonly actionId: string; readonly changedFields: readonly string[]; readonly status: number; execute(dependencies: PortfolioDependencies, context: ExecutionContext): ReturnType<typeof createProject> }): Promise<ActionResponse> {
  const context = requireContext(call.context);
  const service: ServiceRuntimeShape<PortfolioDependencies> = runtime.forOrganisation(context.organisationId);
  return serviceWrite(service, call, { actionId: spec.actionId, resourceType: 'project', context, replayable: true, changedFields: spec.changedFields, execute: async (dependencies) => spec.execute(dependencies, context), respond: (project: Project) => projectResponse(project, spec.status), resourceId: (project) => project.id });
}

/**
 * Déclare une transition du cycle de vie.
 * @param runtime environnement
 * @param declaration transition
 * @returns action enregistrée
 */
function lifecycleAction(runtime: PortfolioRuntime, declaration: LifecycleDeclaration): RegisteredAction {
  return {
    definition: defineAction({ id: `project.${declaration.action}`, permission: declaration.permission, risk: declaration.risk, method: 'POST', path: `/projects/:projectRef/actions/${declaration.path}`, reversible: declaration.action !== 'close', description: declaration.description, rules: ['RG-PRJ-003', 'RG-PRJ-004', 'RG-PRJ-005', 'RG-PRJ-006', 'RG-PRJ-007'] }),
    handle: async (call) => {
      const input = parseInput(TextInput, call.body);
      const ref = projectRefOf(call.params['projectRef']);
      return projectWrite(runtime, call, { actionId: `project.${declaration.action}`, changedFields: ['status'], status: 200, execute: async (dependencies, context) => changeLifecycle(dependencies, context, { ref, action: declaration.action, text: input.text }) });
    },
  };
}

/**
 * Déclare les lectures des projets.
 * @param runtime environnement portfolio
 * @returns actions
 */
function readActions(runtime: PortfolioRuntime): RegisteredAction[] {
  return [
    {
      definition: defineAction({ id: 'project.list', permission: 'project:read', risk: 'R0', method: 'GET', path: '/projects', reversible: true, description: 'Liste les projets accessibles (archivés masqués par défaut).', rules: [] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const includeArchived = call.query['includeArchived'] === 'true';
        const projects = await serviceRead(runtime.forOrganisation(context.organisationId), context.organisationId, async (dependencies) => ok(await listProjects(dependencies, context, includeArchived)));
        return { status: 200, body: { data: projects.map(projectBody), page: { nextCursor: null, limit: projects.length } } };
      },
    },
    {
      definition: defineAction({ id: 'project.get', permission: 'project:read', risk: 'R0', method: 'GET', path: '/projects/:projectRef', reversible: true, description: "Lit un projet et les points bloquants de sa clôture.", rules: ['RG-PRJ-005'] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const ref = projectRefOf(call.params['projectRef']);
        const project = await serviceRead(runtime.forOrganisation(context.organisationId), context.organisationId, async (dependencies) => getProject(dependencies, context, ref));
        return { status: 200, body: { ...projectBody(project), closureBlockers: closureBlockers(project) }, etag: project.version };
      },
    },
  ];
}

/**
 * Déclare la création et la modification des projets.
 * @param runtime environnement portfolio
 * @returns actions
 */
function writeActions(runtime: PortfolioRuntime): RegisteredAction[] {
  return [
    {
      definition: defineAction({ id: 'project.create', permission: 'project:create', risk: 'R1', method: 'POST', path: '/projects', reversible: true, description: 'Crée un projet en brouillon.', rules: ['RG-PRJ-001', 'RG-PRJ-002'] }),
      handle: async (call) => {
        const input = parseInput(CreateInput, call.body);
        return projectWrite(runtime, call, { actionId: 'project.create', changedFields: Object.keys(input), status: 201, execute: async (dependencies, context) => createProject(dependencies, context, input) });
      },
    },
    {
      definition: defineAction({ id: 'project.update', permission: 'project:update', risk: 'R1', method: 'PATCH', path: '/projects/:projectRef', reversible: true, description: "Modifie les informations d'un projet (la clé est immuable).", rules: ['RG-PRJ-001', 'RG-PRJ-004'] }),
      handle: async (call) => {
        const input = parseInput(UpdateInput, call.body);
        const ref = projectRefOf(call.params['projectRef']);
        const changes = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
        return projectWrite(runtime, call, {
          actionId: 'project.update', changedFields: Object.keys(changes), status: 200,
          execute: async (dependencies, context) => {
            const current = await getProject(dependencies, context, ref);
            if (current.ok) checkIfMatch(call.headers.ifMatch, current.value.version);
            return updateProject(dependencies, context, { ref, changes });
          },
        });
      },
    },
  ];
}

/**
 * Déclare les actions des projets.
 * @param runtime environnement portfolio
 * @returns actions enregistrées
 */
export function projectActions(runtime: PortfolioRuntime): RegisteredAction[] {
  return [...readActions(runtime), ...writeActions(runtime), ...LIFECYCLE.map((declaration) => lifecycleAction(runtime, declaration))];
}
