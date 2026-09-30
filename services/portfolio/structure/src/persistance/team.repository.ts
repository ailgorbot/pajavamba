/**
 * Dépôt PostgreSQL des équipes, appartenances et rattachements.
 *
 * Couche : moyenne (portfolio/structure). Règles : RI-COD-09, RI-DON-02.
 */
import { toEntityId, type OrganisationId } from '@pajavamba/kernel';
import type { SqlExecutor } from '@pajavamba/ops';
import type { Team, TeamMembership, TeamRepository } from '@pajavamba/portfolio-fonctionnel';

interface TeamRow {
  readonly organisation_id: string;
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly kind: Team['kind'];
  readonly time_zone: string;
  readonly working_days: readonly number[];
  readonly version: number;
}

interface MemberRow {
  readonly team_id: string;
  readonly user_id: string;
  readonly team_role: TeamMembership['teamRole'];
  readonly allocation_percent: number;
}

const COLUMNS = 't.organisation_id, t.id, t.key, t.name, t.kind, t.time_zone, t.working_days, t.version';

/**
 * Convertit une ligne d'équipe.
 * @param row ligne
 * @returns équipe
 */
function mapTeam(row: TeamRow): Team {
  return { id: row.id, organisationId: toEntityId(row.organisation_id), key: row.key, name: row.name, kind: row.kind, timeZone: row.time_zone, workingDays: row.working_days, version: row.version };
}

/**
 * Crée le dépôt des équipes.
 * @param tx transaction
 * @param organisationId organisation courante
 * @returns dépôt
 */
export function teamRepository(tx: SqlExecutor, organisationId: OrganisationId): TeamRepository {
  const findOne = async (column: 'id' | 'key', value: string): Promise<Team | undefined> => {
    const rows = await tx.query<TeamRow>(`SELECT ${COLUMNS} FROM teams t WHERE t.${column} = $1`, [value]);
    return rows[0] === undefined ? undefined : mapTeam(rows[0]);
  };
  return {
    findById: async (id) => findOne('id', id),
    findByKey: async (key) => findOne('key', key),
    async insert(team) {
      await tx.query('INSERT INTO teams (organisation_id, id, key, name, kind, time_zone, working_days, version) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [team.organisationId, team.id, team.key, team.name, team.kind, team.timeZone, team.workingDays, team.version]);
    },
    async update(team) {
      await tx.query('UPDATE teams SET name = $2, kind = $3, time_zone = $4, working_days = $5, version = $6 WHERE id = $1', [team.id, team.name, team.kind, team.timeZone, team.workingDays, team.version]);
    },
    async attach(projectId, teamId) {
      await tx.query('INSERT INTO project_teams (organisation_id, project_id, team_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [organisationId, projectId, teamId]);
    },
    async listForProject(projectId) {
      const rows = await tx.query<TeamRow>(`SELECT ${COLUMNS} FROM teams t JOIN project_teams pt ON pt.team_id = t.id AND pt.organisation_id = t.organisation_id WHERE pt.project_id = $1 ORDER BY t.name`, [projectId]);
      return rows.map(mapTeam);
    },
    async isAttached(projectId, teamId) {
      const rows = await tx.query('SELECT 1 FROM project_teams WHERE project_id = $1 AND team_id = $2', [projectId, teamId]);
      return rows.length > 0;
    },
    async listMembers(teamId) {
      const rows = await tx.query<MemberRow>('SELECT team_id, user_id, team_role, allocation_percent FROM team_memberships WHERE team_id = $1 ORDER BY user_id', [teamId]);
      return rows.map((row) => ({ teamId: row.team_id, userId: toEntityId(row.user_id), teamRole: row.team_role, allocationPercent: row.allocation_percent }));
    },
    async upsertMember(membership) {
      await tx.query(
        `INSERT INTO team_memberships (organisation_id, team_id, user_id, team_role, allocation_percent) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (organisation_id, team_id, user_id) DO UPDATE SET team_role = EXCLUDED.team_role, allocation_percent = EXCLUDED.allocation_percent`,
        [organisationId, membership.teamId, membership.userId, membership.teamRole, membership.allocationPercent],
      );
    },
    async removeMember(teamId, userId) {
      const rows = await tx.query('DELETE FROM team_memberships WHERE team_id = $1 AND user_id = $2 RETURNING user_id', [teamId, userId]);
      return rows.length > 0;
    },
  };
}
