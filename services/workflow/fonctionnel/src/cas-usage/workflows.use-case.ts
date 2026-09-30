/**
 * Cas d'usage des workflows : instanciation d'un pack, brouillon, publication, liste.
 *
 * Couche : basse (workflow/fonctionnel). Règles : RG-WF-001, RG-WF-002, RG-PRJ-004, RI-MET-04,
 * RI-MET-05, RI-SEC-03.
 */
import { domainError, err, FORBIDDEN, NOT_FOUND, ok, requireAccess, type DomainError, type DomainEvent, type EventValue, type ExecutionContext, type ProjectId, type ProjectRef, type Result, type UseCaseOutput } from '@pajavamba/kernel';
import { findPack, type MethodologyPack } from '../domaine/packs.catalog.ts';
import { publish, validateDefinition, validateWorkflowKey, type Workflow, type WorkflowDefinition, type WorkflowVersion } from '../domaine/workflow.ts';
import type { ProjectSnapshot, WorkflowDependencies } from '../ports/workflow.ports.ts';

/** Types d'événements publiés par workflow. */
export const WORKFLOW_EVENTS = {
  packInstantiated: 'pv.workflow.pack.instantiated.v1',
  workflowPublished: 'pv.workflow.workflow.published.v1',
} as const;

const UNKNOWN_PACK = domainError('workflow.unknown_pack', 'validation', 'Modèle méthodologique inconnu.');
const READ_ONLY = domainError('workflow.project_read_only', 'conflict', 'Ce projet est en lecture seule.');
const READ_ONLY_STATUSES = new Set(['closed', 'archived', 'pending_deletion']);

/**
 * Sérialise une définition pour un événement (données de classe P).
 * @param definition définition
 * @returns valeur d'événement
 */
function definitionValue(definition: WorkflowDefinition): EventValue {
  return JSON.parse(JSON.stringify(definition)) as EventValue;
}

/**
 * Charge un projet visible et vérifie la permission demandée.
 * @param dependencies dépendances
 * @param context contexte
 * @param permission projet, permission requise et exigence d'écriture
 * @returns projet ou erreur
 */
async function loadProject(dependencies: WorkflowDependencies, context: ExecutionContext, permission: { readonly ref: ProjectRef; readonly name: string; readonly risk: 'R0' | 'R2'; readonly writable: boolean }): Promise<Result<ProjectSnapshot, DomainError>> {
  const project = await dependencies.workflows.findProject(permission.ref);
  if (project === undefined) return err(NOT_FOUND);
  if (!(await requireAccess(dependencies.policy, context, { permission: 'project:read', risk: 'R0', projectId: project.id })).ok) return err(NOT_FOUND);
  if (!(await requireAccess(dependencies.policy, context, { permission: permission.name, risk: permission.risk, projectId: project.id })).ok) return err(FORBIDDEN);
  return permission.writable && READ_ONLY_STATUSES.has(project.status) ? err(READ_ONLY) : ok(project);
}

/**
 * Crée et publie les workflows d'un pack pour un projet.
 * @param dependencies dépendances
 * @param projectId projet
 * @param pack pack
 * @returns versions publiées par clé de workflow
 */
async function createPackWorkflows(dependencies: WorkflowDependencies, projectId: ProjectId, pack: MethodologyPack): Promise<{ readonly workflow: Workflow; readonly version: WorkflowVersion }[]> {
  const created: { readonly workflow: Workflow; readonly version: WorkflowVersion }[] = [];
  for (const packWorkflow of pack.workflows) {
    const workflow: Workflow = { id: dependencies.ids.next(), projectId, key: packWorkflow.key, name: packWorkflow.name };
    const version: WorkflowVersion = { id: dependencies.ids.next(), workflowId: workflow.id, number: 1, status: 'published', definition: packWorkflow.definition, publishedAt: dependencies.clock.now() };
    await dependencies.workflows.insertWorkflow(workflow);
    await dependencies.workflows.insertVersion(version);
    created.push({ workflow, version });
  }
  return created;
}

/**
 * Instancie le pack méthodologique d'un projet créé (réaction à `project.created`).
 * @param dependencies dépendances
 * @param project projet créé
 * @returns événement `pack.instantiated`
 */
export async function instantiatePack(dependencies: WorkflowDependencies, project: ProjectSnapshot): Promise<Result<UseCaseOutput<null>, DomainError>> {
  const pack = findPack(project.packKey);
  if (pack === undefined) return err(UNKNOWN_PACK);
  await dependencies.workflows.upsertProject(project);
  if ((await dependencies.workflows.listWorkflows(project.id)).length > 0) return ok({ result: null, events: [] });
  const created = await createPackWorkflows(dependencies, project.id, pack);
  const event: DomainEvent = {
    type: WORKFLOW_EVENTS.packInstantiated,
    aggregateId: project.id,
    aggregateVersion: 1,
    data: {
      projectId: project.id,
      packKey: pack.key,
      packVersion: pack.version,
      iterations: pack.iterations,
      types: pack.types.map((type) => ({ key: type.key, name: type.name, level: type.level, allowedParentKeys: [...type.allowedParentKeys], workflowKey: type.workflowKey })),
      workflows: created.map(({ workflow, version }) => ({ workflowId: workflow.id, key: workflow.key, name: workflow.name, versionId: version.id, number: version.number, definition: definitionValue(version.definition) })),
    },
  };
  return ok({ result: null, events: [event] });
}

/** Entrée d'un brouillon de workflow. */
export interface DraftWorkflowInput {
  readonly ref: ProjectRef;
  readonly key: string;
  readonly name: string;
  readonly definition: WorkflowDefinition;
}

/**
 * Crée une nouvelle version brouillon d'un workflow (nouveau workflow si la clé est inconnue).
 * @param dependencies dépendances
 * @param context contexte
 * @param input projet, clé, nom et définition
 * @returns version brouillon
 */
export async function draftWorkflow(dependencies: WorkflowDependencies, context: ExecutionContext, input: DraftWorkflowInput): Promise<Result<UseCaseOutput<WorkflowVersion>, DomainError>> {
  const project = await loadProject(dependencies, context, { ref: input.ref, name: 'workflow:configure', risk: 'R2', writable: true });
  if (!project.ok) return project;
  const key = validateWorkflowKey(input.key);
  if (!key.ok) return key;
  const definition = validateDefinition(input.definition);
  if (!definition.ok) return definition;
  let workflow = await dependencies.workflows.findWorkflow(project.value.id, key.value);
  if (workflow === undefined) {
    workflow = { id: dependencies.ids.next(), projectId: project.value.id, key: key.value, name: input.name.trim().slice(0, 80) };
    await dependencies.workflows.insertWorkflow(workflow);
  }
  const version: WorkflowVersion = { id: dependencies.ids.next(), workflowId: workflow.id, number: (await dependencies.workflows.latestVersionNumber(workflow.id)) + 1, status: 'draft', definition: definition.value, publishedAt: null };
  await dependencies.workflows.insertVersion(version);
  return ok({ result: version, events: [] });
}

/**
 * Publie une version brouillon (RG-WF-001 : elle devient immuable).
 * @param dependencies dépendances
 * @param context contexte
 * @param request projet et version
 * @returns version publiée
 */
export async function publishWorkflowVersion(dependencies: WorkflowDependencies, context: ExecutionContext, request: { readonly ref: ProjectRef; readonly versionId: string }): Promise<Result<UseCaseOutput<WorkflowVersion>, DomainError>> {
  const { versionId } = request;
  const project = await loadProject(dependencies, context, { ref: request.ref, name: 'workflow:configure', risk: 'R2', writable: true });
  if (!project.ok) return project;
  const version = await dependencies.workflows.findVersion(versionId);
  const workflows = await dependencies.workflows.listWorkflows(project.value.id);
  const workflow = workflows.find((entry) => entry.workflow.id === version?.workflowId)?.workflow;
  if (version === undefined || workflow === undefined) return err(NOT_FOUND);
  const published = publish(version, dependencies.clock.now());
  if (!published.ok) return published;
  await dependencies.workflows.updateDraft(published.value);
  const data = { projectId: project.value.id, workflowId: workflow.id, key: workflow.key, name: workflow.name, versionId: published.value.id, number: published.value.number, definition: definitionValue(published.value.definition) };
  return ok({ result: published.value, events: [{ type: WORKFLOW_EVENTS.workflowPublished, aggregateId: workflow.id, aggregateVersion: published.value.number, data }] });
}

/**
 * Liste les workflows d'un projet et leurs versions.
 * @param dependencies dépendances
 * @param context contexte
 * @param ref projet
 * @returns workflows
 */
export async function listProjectWorkflows(dependencies: WorkflowDependencies, context: ExecutionContext, ref: ProjectRef): Promise<Result<readonly { readonly workflow: Workflow; readonly versions: readonly WorkflowVersion[] }[], DomainError>> {
  const project = await loadProject(dependencies, context, { ref, name: 'project:read', risk: 'R0', writable: false });
  if (!project.ok) return project;
  return ok(await dependencies.workflows.listWorkflows(project.value.id));
}
