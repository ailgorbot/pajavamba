/**
 * Ports requis par les cas d'usage du service portfolio.
 *
 * Couche : basse (portfolio/fonctionnel). Règles : RI-ARC-08, RI-ARC-10.
 */
import type { AccessPolicy, Clock, IdGenerator, ProjectId, UserId } from '@pajavamba/kernel';
import type { Project } from '../domaine/project.ts';
import type { Team, TeamMembership } from '../domaine/team.ts';

/** Dépôt des projets. */
export interface ProjectRepository {
  findById(id: ProjectId): Promise<Project | undefined>;
  findByKey(key: string): Promise<Project | undefined>;
  list(filter: { readonly projectIds: readonly ProjectId[] | 'all'; readonly includeArchived: boolean }): Promise<readonly Project[]>;
  insert(project: Project): Promise<void>;
  /** Met à jour avec verrouillage optimiste (version précédente = version - 1). */
  update(project: Project): Promise<void>;
  /** Met à jour les champs dérivés d'autres services, sans changer la version d'agrégat. */
  updateDerived(id: ProjectId, fields: { readonly configurationReady?: boolean; readonly openItemDelta?: number }): Promise<void>;
  listDueForPurge(now: number): Promise<readonly Project[]>;
  delete(id: ProjectId): Promise<void>;
}

/** Dépôt des équipes. */
export interface TeamRepository {
  findById(id: string): Promise<Team | undefined>;
  findByKey(key: string): Promise<Team | undefined>;
  insert(team: Team): Promise<void>;
  update(team: Team): Promise<void>;
  attach(projectId: ProjectId, teamId: string): Promise<void>;
  listForProject(projectId: ProjectId): Promise<readonly Team[]>;
  isAttached(projectId: ProjectId, teamId: string): Promise<boolean>;
  listMembers(teamId: string): Promise<readonly TeamMembership[]>;
  upsertMember(membership: TeamMembership): Promise<void>;
  removeMember(teamId: string, userId: UserId): Promise<boolean>;
}

/** Dépendances des cas d'usage portfolio. */
export interface PortfolioDependencies {
  readonly projects: ProjectRepository;
  readonly teams: TeamRepository;
  readonly policy: AccessPolicy;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}
