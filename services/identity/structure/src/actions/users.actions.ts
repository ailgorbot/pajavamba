/**
 * Actions d'administration des utilisateurs et des rôles : liste, invitation, acceptation,
 * désactivation, réactivation, attributions, membres d'un projet.
 *
 * Couche : moyenne (identity/structure). Règles : RI-HAB-02 (R3), RI-CNX-10, RG-IAM-002, RG-ORG-001.
 */
import { defineAction, type ActionCall, type RegisteredAction } from '@pajavamba/contracts';
import { acceptInvitation, assignRole, deactivateUser, inviteUser, listProjectMembers, reactivateUser, revokeRole, SYSTEM_ROLES, type RoleAssignment } from '@pajavamba/identity-fonctionnel';
import { isUuid, ok, publicIdToUuid, requireAccess, toEntityId, type ProjectId, type UserId } from '@pajavamba/kernel';
import { HttpProblem, parseInput, requireContext, withTransaction } from '@pajavamba/ops';
import { z } from 'zod';
import { IDENTITY_SCOPE, identityRead, identityWrite, publicContext, type IdentityRuntime } from '../composition/identity-runtime.ts';

const InviteInput = z.strictObject({
  email: z.email().max(320).describe("Adresse de l'invité"),
  displayName: z.string().max(120).describe('Nom affiché'),
  orgRole: z.enum(['admin', 'auditor', 'member']).describe("Rôle d'organisation"),
});
const AcceptInput = z.strictObject({ code: z.string().min(10).max(100).describe("Code d'invitation"), password: z.string().max(256).describe('Mot de passe choisi') });
const AssignInput = z.strictObject({
  userId: z.uuid().describe('Utilisateur'),
  roleKey: z.string().max(60).describe('Rôle'),
  projectId: z.string().max(40).nullable().describe('Projet (identifiant public) ou null pour l’organisation'),
  effect: z.enum(['allow', 'deny']).default('allow').describe('Autorisation ou refus explicite'),
});

const NOT_FOUND = new HttpProblem({ status: 404, code: 'identity.not_found', title: 'Ressource introuvable', detail: "La ressource demandée n'existe pas ou n'est pas accessible." });

/**
 * Convertit un identifiant public (ou UUID) de projet.
 * @param value identifiant reçu
 * @returns identifiant de projet
 */
function projectIdOf(value: string): ProjectId {
  const uuid = isUuid(value) ? value : publicIdToUuid(value);
  if (uuid === undefined) throw NOT_FOUND;
  return toEntityId(uuid);
}

/**
 * Convertit un identifiant d'utilisateur reçu en paramètre.
 * @param value identifiant reçu
 * @returns identifiant d'utilisateur
 */
function userIdOf(value: string | undefined): UserId {
  if (value === undefined || !isUuid(value)) throw NOT_FOUND;
  return toEntityId(value);
}

/**
 * Sérialise une attribution.
 * @param assignment attribution
 * @returns représentation API
 */
function assignmentBody(assignment: RoleAssignment): Record<string, unknown> {
  return { id: assignment.id, userId: assignment.userId, roleKey: assignment.roleKey, scopeType: assignment.scope.type, projectId: assignment.scope.type === 'project' ? assignment.scope.projectId : null, effect: assignment.effect };
}

/**
 * Accepte une invitation : l'organisation est lue avant d'ouvrir le contexte RLS.
 * @param runtime environnement
 * @param call appel
 * @returns réponse
 */
async function accept(runtime: IdentityRuntime, call: ActionCall): Promise<{ readonly status: number; readonly body: unknown }> {
  const input = parseInput(AcceptInput, call.body);
  const rows = await withTransaction(runtime.pool, IDENTITY_SCOPE, (tx) => tx.query<{ readonly organisation_id: string }>('SELECT organisation_id FROM invitations WHERE code_hash = $1', [runtime.secrets.hashSecret(input.code)]));
  const context = { ...publicContext(call), organisationId: toEntityId<'organisation'>(rows[0]?.organisation_id ?? '') };
  return identityWrite(runtime, call, { actionId: 'invitation.accept', resourceType: 'user', context, replayable: false, execute: async (dependencies) => acceptInvitation(dependencies, input.code, input.password), respond: () => ({ status: 204, body: null }), resourceId: (result) => result.userId });
}

/**
 * Déclare les actions d'administration des utilisateurs.
 * @param runtime environnement identity
 * @returns actions enregistrées
 */
export function userActions(runtime: IdentityRuntime): RegisteredAction[] {
  const status = (id: string, verb: 'deactivate' | 'reactivate'): RegisteredAction => ({
    definition: defineAction({ id, permission: 'user:manage', risk: 'R3', method: 'POST', path: `/users/:userId/actions/${verb}`, reversible: true, description: verb === 'deactivate' ? 'Désactive un utilisateur et révoque ses accès.' : 'Réactive un utilisateur.', rules: ['RG-IAM-005', 'RG-ORG-001'] }),
    handle: async (call) => {
      const context = requireContext(call.context);
      const userId = userIdOf(call.params['userId']);
      return identityWrite(runtime, call, { actionId: id, resourceType: 'user', context, replayable: true, changedFields: ['status'], execute: async (dependencies) => (verb === 'deactivate' ? deactivateUser(dependencies, context, userId) : reactivateUser(dependencies, context, userId)), respond: () => ({ status: 204, body: null }), resourceId: () => userId });
    },
  });
  return [
    {
      definition: defineAction({ id: 'user.list', permission: 'organisation:read', risk: 'R0', method: 'GET', path: '/users', reversible: true, description: "Liste les membres de l'organisation.", rules: [] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const members = await identityRead(runtime, context.organisationId, async (dependencies) => {
          const access = await requireAccess(dependencies.policy, context, { permission: 'organisation:read', risk: 'R0' });
          return access.ok ? ok(await dependencies.organisations.listMembers(context.organisationId)) : access;
        });
        return { status: 200, body: { data: members.map(({ user, membership }) => ({ id: user.id, email: user.email, displayName: user.displayName, status: user.status, orgRole: membership.orgRole })), page: { nextCursor: null, limit: members.length } } };
      },
    },
    {
      definition: defineAction({ id: 'user.invite', permission: 'user:manage', risk: 'R3', method: 'POST', path: '/users', reversible: true, description: "Invite un utilisateur ; le code d'invitation est affiché une seule fois.", rules: [] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const input = parseInput(InviteInput, call.body);
        return identityWrite(runtime, call, { actionId: 'user.invite', resourceType: 'user', context, replayable: false, changedFields: ['email', 'displayName', 'orgRole'], execute: async (dependencies) => inviteUser(dependencies, context, input), respond: (result) => ({ status: 201, body: result }), resourceId: (result) => result.userId });
      },
    },
    {
      definition: defineAction({ id: 'invitation.accept', permission: 'public', risk: 'R1', method: 'POST', path: '/invitations/accept', reversible: false, description: 'Accepte une invitation en choisissant son mot de passe.', rules: [] }),
      handle: async (call) => accept(runtime, call),
    },
    status('user.deactivate', 'deactivate'),
    status('user.reactivate', 'reactivate'),
    {
      definition: defineAction({ id: 'role.list', permission: 'organisation:read', risk: 'R0', method: 'GET', path: '/roles', reversible: true, description: 'Liste les rôles disponibles et leurs permissions.', rules: [] }),
      handle: async (call) => {
        requireContext(call.context);
        return { status: 200, body: { data: SYSTEM_ROLES, page: { nextCursor: null, limit: SYSTEM_ROLES.length } } };
      },
    },
    {
      definition: defineAction({ id: 'role.assign', permission: 'role:manage', risk: 'R3', method: 'POST', path: '/role-assignments', reversible: true, description: 'Attribue ou refuse explicitement un rôle (organisation ou projet).', rules: ['RG-IAM-002'] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const input = parseInput(AssignInput, call.body);
        const assignInput = { userId: toEntityId<'user'>(input.userId), roleKey: input.roleKey, projectId: input.projectId === null ? null : projectIdOf(input.projectId), effect: input.effect };
        return identityWrite(runtime, call, { actionId: 'role.assign', resourceType: 'role_assignment', context, replayable: true, changedFields: ['roleKey', 'effect'], execute: async (dependencies) => assignRole(dependencies, context, assignInput), respond: (assignment) => ({ status: 201, body: assignmentBody(assignment) }), resourceId: (assignment) => assignment.id });
      },
    },
    {
      definition: defineAction({ id: 'role.revoke', permission: 'role:manage', risk: 'R3', method: 'DELETE', path: '/role-assignments/:assignmentId', reversible: true, description: 'Retire une attribution de rôle.', rules: ['RG-ORG-001'] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const assignmentId = userIdOf(call.params['assignmentId']);
        return identityWrite(runtime, call, { actionId: 'role.revoke', resourceType: 'role_assignment', context, replayable: true, execute: async (dependencies) => revokeRole(dependencies, context, assignmentId), respond: () => ({ status: 204, body: null }), resourceId: () => assignmentId });
      },
    },
    {
      definition: defineAction({ id: 'project_member.list', permission: 'project:read', risk: 'R0', method: 'GET', path: '/projects/:projectRef/members', reversible: true, description: "Liste les attributions de rôles d'un projet.", rules: [] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const projectId = projectIdOf(call.params['projectRef'] ?? '');
        const assignments = await identityRead(runtime, context.organisationId, async (dependencies) => listProjectMembers(dependencies, context, projectId));
        return { status: 200, body: { data: assignments.map(assignmentBody), page: { nextCursor: null, limit: assignments.length } } };
      },
    },
  ];
}
