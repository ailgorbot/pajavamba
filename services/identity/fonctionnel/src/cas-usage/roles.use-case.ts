/**
 * Cas d'usage des attributions de rôles : attribution, retrait, membres d'un projet, rôle du créateur.
 *
 * Couche : basse (identity/fonctionnel). Règles : RG-IAM-002 (refus explicites), RG-ORG-001,
 * RI-HAB-02 (`role:manage` et `project:manage_members` sont R3), §7.2.
 */
import { domainError, err, ok, requireAccess, type DomainError, type ExecutionContext, type ProjectId, type Result, type UseCaseOutput, type UserId } from '@pajavamba/kernel';
import type { RoleAssignment } from '../domaine/identity-model.ts';
import { IDENTITY_EVENTS, identityEvent } from '../domaine/identity.events.ts';
import { findSystemRole } from '../domaine/roles.catalog.ts';
import type { IdentityDependencies } from '../ports/identity.ports.ts';

/** Entrée d'une attribution. */
export interface AssignRoleInput {
  readonly userId: UserId;
  readonly roleKey: string;
  readonly projectId: ProjectId | null;
  readonly effect: 'allow' | 'deny';
}

const UNKNOWN_ROLE = domainError('identity.unknown_role', 'validation', "Ce rôle n'existe pas pour cette portée.");
const NOT_A_MEMBER = domainError('identity.not_a_member', 'validation', "Cet utilisateur n'appartient pas à l'organisation.");
const ASSIGNMENT_NOT_FOUND = domainError('identity.assignment_not_found', 'not_found', 'Attribution introuvable.');
const LAST_OWNER = domainError('identity.last_owner', 'conflict', "L'organisation doit conserver au moins un propriétaire actif.");

/**
 * Exige la permission de gestion adaptée à la portée (organisation ou projet).
 * @param dependencies dépendances
 * @param context contexte
 * @param projectId projet ou `null`
 * @returns succès ou refus
 */
async function requireManagement(dependencies: IdentityDependencies, context: ExecutionContext, projectId: ProjectId | null): Promise<Result<true, DomainError>> {
  return projectId === null
    ? requireAccess(dependencies.policy, context, { permission: 'role:manage', risk: 'R3' })
    : requireAccess(dependencies.policy, context, { permission: 'project:manage_members', risk: 'R3', projectId });
}

/**
 * Événement d'attribution portant les permissions du rôle (projection locale de la politique).
 * @param assignment attribution
 * @param permissions permissions du rôle
 * @returns événement
 */
function assignedEvent(assignment: RoleAssignment, permissions: readonly string[]): ReturnType<typeof identityEvent> {
  const scopeId = assignment.scope.type === 'project' ? assignment.scope.projectId : assignment.organisationId;
  return identityEvent(IDENTITY_EVENTS.roleAssigned, assignment.id, { userId: assignment.userId, roleKey: assignment.roleKey, scopeType: assignment.scope.type, scopeId, effect: assignment.effect, permissions: [...permissions] });
}

/**
 * Attribue (ou refuse explicitement) un rôle à un utilisateur (`role.assign`).
 * @param dependencies dépendances
 * @param context contexte d'exécution
 * @param input utilisateur, rôle, portée et effet
 * @returns attribution créée
 */
export async function assignRole(dependencies: IdentityDependencies, context: ExecutionContext, input: AssignRoleInput): Promise<Result<UseCaseOutput<RoleAssignment>, DomainError>> {
  const access = await requireManagement(dependencies, context, input.projectId);
  if (!access.ok) return access;
  const role = findSystemRole(input.roleKey);
  const expectedScope = input.projectId === null ? 'organisation' : 'project';
  if (role?.scopeType !== expectedScope) return err(UNKNOWN_ROLE);
  if ((await dependencies.organisations.findMembership(context.organisationId, input.userId)) === undefined) return err(NOT_A_MEMBER);
  const assignment: RoleAssignment = {
    id: dependencies.ids.next(),
    organisationId: context.organisationId,
    userId: input.userId,
    roleKey: role.key,
    scope: input.projectId === null ? { type: 'organisation' } : { type: 'project', projectId: input.projectId },
    effect: input.effect,
    grantedBy: context.actor.kind === 'user' ? context.actor.userId : null,
  };
  await dependencies.assignments.insert(assignment);
  return ok({ result: assignment, events: [assignedEvent(assignment, role.permissions)] });
}

/**
 * Retire une attribution (`role.revoke`) ; le dernier propriétaire ne peut être retiré.
 * @param dependencies dépendances
 * @param context contexte d'exécution
 * @param assignmentId attribution à retirer
 * @returns événements
 */
export async function revokeRole(dependencies: IdentityDependencies, context: ExecutionContext, assignmentId: string): Promise<Result<UseCaseOutput<null>, DomainError>> {
  const assignment = await dependencies.assignments.findById(context.organisationId, assignmentId);
  if (assignment === undefined) return err(ASSIGNMENT_NOT_FOUND);
  const access = await requireManagement(dependencies, context, assignment.scope.type === 'project' ? assignment.scope.projectId : null);
  if (!access.ok) return access;
  if (assignment.roleKey === 'owner' && (await dependencies.assignments.countOwners(context.organisationId)) <= 1) return err(LAST_OWNER);
  await dependencies.assignments.delete(context.organisationId, assignmentId);
  return ok({ result: null, events: [identityEvent(IDENTITY_EVENTS.roleRevoked, assignmentId, { userId: assignment.userId })] });
}

/**
 * Liste les attributions d'un projet (`project_member.list`).
 * @param dependencies dépendances
 * @param context contexte d'exécution
 * @param projectId projet
 * @returns attributions du projet
 */
export async function listProjectMembers(dependencies: IdentityDependencies, context: ExecutionContext, projectId: ProjectId): Promise<Result<readonly RoleAssignment[], DomainError>> {
  const access = await requireAccess(dependencies.policy, context, { permission: 'project:read', risk: 'R0', projectId });
  if (!access.ok) return access;
  return ok(await dependencies.assignments.listForProject(context.organisationId, projectId));
}

/**
 * Attribue le rôle d'administrateur de projet au créateur d'un projet (réaction à `project.created`).
 * @param dependencies dépendances
 * @param context contexte système de l'organisation
 * @param request projet créé et créateur
 * @returns attribution et événement
 */
export async function grantCreatorRole(dependencies: IdentityDependencies, context: ExecutionContext, request: { readonly projectId: ProjectId; readonly creatorId: UserId }): Promise<Result<UseCaseOutput<RoleAssignment>, DomainError>> {
  const { projectId, creatorId } = request;
  const existing = await dependencies.assignments.listForProject(context.organisationId, projectId);
  const already = existing.find((assignment) => assignment.userId === creatorId && assignment.roleKey === 'project_admin');
  if (already !== undefined) return ok({ result: already, events: [] });
  const role = findSystemRole('project_admin');
  if (role === undefined) return err(UNKNOWN_ROLE);
  const assignment: RoleAssignment = { id: dependencies.ids.next(), organisationId: context.organisationId, userId: creatorId, roleKey: role.key, scope: { type: 'project', projectId }, effect: 'allow', grantedBy: null };
  await dependencies.assignments.insert(assignment);
  return ok({ result: assignment, events: [assignedEvent(assignment, role.permissions)] });
}
