/**
 * Actions des équipes d'un projet : liste, création, ajout et retrait de membres.
 *
 * Couche : moyenne (portfolio/structure). Règles : RI-API-01, RI-HAB-02.
 */
import { defineAction, type RegisteredAction } from '@pajavamba/contracts';
import { isUuid, toEntityId } from '@pajavamba/kernel';
import { parseInput, requireContext, serviceRead, serviceWrite } from '@pajavamba/ops';
import { addTeamMember, createTeam, listTeams, removeTeamMember, type Team } from '@pajavamba/portfolio-fonctionnel';
import { z } from 'zod';
import type { PortfolioRuntime } from '../composition/portfolio-runtime.ts';
import { PROJECT_NOT_FOUND, projectRefOf } from './project-ref.ts';

const TeamInput = z.strictObject({
  key: z.string().max(6).describe("Clé d'équipe (ex. ALPHA)"),
  name: z.string().max(120).describe('Nom'),
  kind: z.enum(['scrum', 'kanban', 'scrumban', 'other']).describe('Nature'),
  timeZone: z.string().min(1).max(64).default('Europe/Paris').describe('Fuseau IANA'),
  workingDays: z.array(z.number().int()).max(7).default([1, 2, 3, 4, 5]).describe('Jours travaillés (1 = lundi)'),
});
const MemberInput = z.strictObject({
  userId: z.uuid().describe('Membre'),
  teamRole: z.enum(['member', 'scrum_master', 'product_owner', 'other']).default('member').describe("Rôle dans l'équipe"),
  allocationPercent: z.number().int().default(100).describe('Allocation (1 à 100 %)'),
});

/**
 * Représentation API d'une équipe.
 * @param team équipe
 * @returns corps JSON
 */
function teamBody(team: Team): Record<string, unknown> {
  return { id: team.id, key: team.key, name: team.name, kind: team.kind, timeZone: team.timeZone, workingDays: team.workingDays };
}

/**
 * Valide un identifiant de chemin.
 * @param value paramètre
 * @returns identifiant
 */
function idParam(value: string | undefined): string {
  if (value === undefined || !isUuid(value)) throw PROJECT_NOT_FOUND;
  return value;
}

/**
 * Déclare les actions des équipes.
 * @param runtime environnement portfolio
 * @returns actions enregistrées
 */
export function teamActions(runtime: PortfolioRuntime): RegisteredAction[] {
  return [
    {
      definition: defineAction({ id: 'team.list', permission: 'team:read', risk: 'R0', method: 'GET', path: '/projects/:projectRef/teams', reversible: true, description: "Liste les équipes d'un projet et leurs membres.", rules: [] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const ref = projectRefOf(call.params['projectRef']);
        const teams = await serviceRead(runtime.forOrganisation(context.organisationId), context.organisationId, async (dependencies) => listTeams(dependencies, context, ref));
        return { status: 200, body: { data: teams.map(({ team, members }) => ({ ...teamBody(team), members })), page: { nextCursor: null, limit: teams.length } } };
      },
    },
    {
      definition: defineAction({ id: 'team.create', permission: 'team:manage', risk: 'R1', method: 'POST', path: '/projects/:projectRef/teams', reversible: true, description: 'Crée une équipe rattachée au projet.', rules: ['RG-PRJ-004'] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const input = parseInput(TeamInput, call.body);
        const ref = projectRefOf(call.params['projectRef']);
        return serviceWrite(runtime.forOrganisation(context.organisationId), call, { actionId: 'team.create', resourceType: 'team', context, replayable: true, changedFields: Object.keys(input), execute: async (dependencies) => createTeam(dependencies, context, ref, input), respond: (team) => ({ status: 201, body: teamBody(team) }), resourceId: (team) => team.id });
      },
    },
    {
      definition: defineAction({ id: 'team.add_member', permission: 'team:manage_members', risk: 'R3', method: 'POST', path: '/projects/:projectRef/teams/:teamId/members', reversible: true, description: 'Ajoute ou modifie un membre d’équipe.', rules: ['RG-IA-002'] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const input = parseInput(MemberInput, call.body);
        const ref = projectRefOf(call.params['projectRef']);
        const teamId = idParam(call.params['teamId']);
        return serviceWrite(runtime.forOrganisation(context.organisationId), call, { actionId: 'team.add_member', resourceType: 'team', context, replayable: true, changedFields: ['teamRole', 'allocationPercent'], execute: async (dependencies) => addTeamMember(dependencies, context, ref, { teamId, userId: toEntityId(input.userId), teamRole: input.teamRole, allocationPercent: input.allocationPercent }), respond: (membership) => ({ status: 201, body: membership }), resourceId: () => teamId });
      },
    },
    {
      definition: defineAction({ id: 'team.remove_member', permission: 'team:manage_members', risk: 'R3', method: 'DELETE', path: '/projects/:projectRef/teams/:teamId/members/:userId', reversible: true, description: 'Retire un membre d’équipe.', rules: [] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const ref = projectRefOf(call.params['projectRef']);
        const teamId = idParam(call.params['teamId']);
        const userId = toEntityId<'user'>(idParam(call.params['userId']));
        return serviceWrite(runtime.forOrganisation(context.organisationId), call, { actionId: 'team.remove_member', resourceType: 'team', context, replayable: true, execute: async (dependencies) => removeTeamMember(dependencies, context, ref, teamId, userId), respond: () => ({ status: 204, body: null }), resourceId: () => teamId });
      },
    },
  ];
}
