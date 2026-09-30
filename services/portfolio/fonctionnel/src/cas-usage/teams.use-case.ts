/**
 * Cas d'usage des équipes : création (rattachée au projet), modification, membres, liste.
 *
 * Couche : basse (portfolio/fonctionnel). Règles : RG-PRJ-004 (projet en lecture seule),
 * RI-HAB-02 (`team:manage_members` est R3), RG-IA-002 (aucune donnée individuelle de performance).
 */
import { domainError, err, ok, type DomainError, type ExecutionContext, type Result, type UseCaseOutput, type UserId } from '@pajavamba/kernel';
import { PORTFOLIO_EVENTS } from '../domaine/portfolio.events.ts';
import { validateProjectName } from '../domaine/project.ts';
import { validateAllocation, validateTeamKey, validateWorkingDays, type Team, type TeamKind, type TeamMembership, type TeamRole } from '../domaine/team.ts';
import type { PortfolioDependencies } from '../ports/portfolio.ports.ts';
import { loadProject, type ProjectRef } from './project-access.ts';

/** Entrée de la création d'une équipe. */
export interface CreateTeamInput {
  readonly key: string;
  readonly name: string;
  readonly kind: TeamKind;
  readonly timeZone: string;
  readonly workingDays: readonly number[];
}

const TEAM_KEY_TAKEN = domainError('portfolio.team_key_taken', 'conflict', "Cette clé d'équipe est déjà utilisée.");
const TEAM_NOT_FOUND = domainError('portfolio.team_not_found', 'not_found', 'Équipe introuvable dans ce projet.');
const MEMBER_NOT_FOUND = domainError('portfolio.team_member_not_found', 'not_found', "Cette personne n'est pas membre de l'équipe.");

/**
 * Crée une équipe et la rattache au projet (`team.create`).
 * @param dependencies dépendances
 * @param context contexte
 * @param ref projet
 * @param input équipe
 * @returns équipe créée
 */
export async function createTeam(dependencies: PortfolioDependencies, context: ExecutionContext, ref: ProjectRef, input: CreateTeamInput): Promise<Result<UseCaseOutput<Team>, DomainError>> {
  const project = await loadProject(dependencies, context, ref, { permission: 'team:manage', risk: 'R1', writable: true });
  if (!project.ok) return project;
  const key = validateTeamKey(input.key);
  if (!key.ok) return key;
  const name = validateProjectName(input.name);
  if (!name.ok) return name;
  const days = validateWorkingDays(input.workingDays);
  if (!days.ok) return days;
  if ((await dependencies.teams.findByKey(key.value)) !== undefined) return err(TEAM_KEY_TAKEN);
  const team: Team = { id: dependencies.ids.next(), organisationId: context.organisationId, key: key.value, name: name.value, kind: input.kind, timeZone: input.timeZone, workingDays: days.value, version: 1 };
  await dependencies.teams.insert(team);
  await dependencies.teams.attach(project.value.id, team.id);
  return ok({ result: team, events: [{ type: PORTFOLIO_EVENTS.teamCreated, aggregateId: team.id, aggregateVersion: 1, data: { key: team.key, name: team.name, kind: team.kind, projectId: project.value.id } }] });
}

/**
 * Liste les équipes rattachées à un projet (`team.list`).
 * @param dependencies dépendances
 * @param context contexte
 * @param ref projet
 * @returns équipes et membres
 */
export async function listTeams(dependencies: PortfolioDependencies, context: ExecutionContext, ref: ProjectRef): Promise<Result<readonly { readonly team: Team; readonly members: readonly TeamMembership[] }[], DomainError>> {
  const project = await loadProject(dependencies, context, ref, { permission: 'team:read', risk: 'R0', writable: false });
  if (!project.ok) return project;
  const teams = await dependencies.teams.listForProject(project.value.id);
  return ok(await Promise.all(teams.map(async (team) => ({ team, members: await dependencies.teams.listMembers(team.id) }))));
}

/** Entrée de l'ajout d'un membre. */
export interface TeamMemberInput {
  readonly teamId: string;
  readonly userId: UserId;
  readonly teamRole: TeamRole;
  readonly allocationPercent: number;
}

/**
 * Ajoute ou modifie un membre d'équipe (`team.add_member`).
 * @param dependencies dépendances
 * @param context contexte
 * @param ref projet
 * @param input membre
 * @returns appartenance
 */
export async function addTeamMember(dependencies: PortfolioDependencies, context: ExecutionContext, ref: ProjectRef, input: TeamMemberInput): Promise<Result<UseCaseOutput<TeamMembership>, DomainError>> {
  const project = await loadProject(dependencies, context, ref, { permission: 'team:manage_members', risk: 'R3', writable: true });
  if (!project.ok) return project;
  if (!(await dependencies.teams.isAttached(project.value.id, input.teamId))) return err(TEAM_NOT_FOUND);
  const allocation = validateAllocation(input.allocationPercent);
  if (!allocation.ok) return allocation;
  const membership: TeamMembership = { teamId: input.teamId, userId: input.userId, teamRole: input.teamRole, allocationPercent: allocation.value };
  await dependencies.teams.upsertMember(membership);
  return ok({ result: membership, events: [{ type: PORTFOLIO_EVENTS.teamMemberAdded, aggregateId: input.teamId, aggregateVersion: 1, data: { userId: input.userId, teamRole: input.teamRole } }] });
}

/**
 * Retire un membre d'équipe (`team.remove_member`).
 * @param dependencies dépendances
 * @param context contexte
 * @param ref projet
 * @param teamId équipe
 * @param userId membre
 * @returns événements
 */
export async function removeTeamMember(dependencies: PortfolioDependencies, context: ExecutionContext, ref: ProjectRef, teamId: string, userId: UserId): Promise<Result<UseCaseOutput<null>, DomainError>> {
  const project = await loadProject(dependencies, context, ref, { permission: 'team:manage_members', risk: 'R3', writable: true });
  if (!project.ok) return project;
  if (!(await dependencies.teams.isAttached(project.value.id, teamId))) return err(TEAM_NOT_FOUND);
  if (!(await dependencies.teams.removeMember(teamId, userId))) return err(MEMBER_NOT_FOUND);
  return ok({ result: null, events: [{ type: PORTFOLIO_EVENTS.teamMemberRemoved, aggregateId: teamId, aggregateVersion: 1, data: { userId } }] });
}
