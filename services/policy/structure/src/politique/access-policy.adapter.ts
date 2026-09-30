/**
 * Adaptateur du port `AccessPolicy` évalué localement sur la projection des attributions.
 *
 * Couche : moyenne (policy/structure). Règles : RI-ARC-10, RI-CNX-05 (droits recalculés à chaque
 * appel, aucun cache de décision), RI-SRV-03 (aucun saut synchrone vers identity), §4.6.
 */
import type { AccessPolicy, Clock, ExecutionContext, ProjectId, ProjectScope } from '@pajavamba/kernel';
import { toEntityId } from '@pajavamba/kernel';
import { withTransaction, type SqlExecutor } from '@pajavamba/ops';
import { decide, type EffectiveGrant } from '@pajavamba/policy-fonctionnel';
import type pg from 'pg';

/** Portée PostgreSQL du service policy. */
export const POLICY_SCOPE = { schema: 'policy', role: 'pv_policy_app' } as const;

interface AssignmentRow {
  readonly scope_type: 'organisation' | 'project';
  readonly scope_id: string;
  readonly effect: 'allow' | 'deny';
  readonly permissions: readonly string[];
}

/**
 * Lit les attributions de l'acteur ; un utilisateur désactivé n'en a aucune.
 * @param tx transaction
 * @param userId utilisateur
 * @returns lignes d'attribution
 */
async function assignmentsOf(tx: SqlExecutor, userId: string): Promise<readonly AssignmentRow[]> {
  const inactive = await tx.query('SELECT 1 FROM inactive_users WHERE user_id = $1', [userId]);
  if (inactive.length > 0) return [];
  return tx.query<AssignmentRow>('SELECT scope_type, scope_id, effect, permissions FROM assignments WHERE user_id = $1', [userId]);
}

/**
 * Déplie les attributions applicables à une portée en attributions de permissions.
 * @param rows attributions
 * @param projectId projet visé
 * @returns attributions effectives
 */
function grantsFor(rows: readonly AssignmentRow[], projectId: ProjectId | undefined): EffectiveGrant[] {
  return rows
    .filter((row) => row.scope_type === 'organisation' || row.scope_id === String(projectId))
    .flatMap((row) => row.permissions.map((permission) => ({ permission, effect: row.effect })));
}

/**
 * Calcule les projets sur lesquels une permission est accordée.
 * @param rows attributions
 * @param permission permission
 * @returns portée de projets
 */
function scopeOf(rows: readonly AssignmentRow[], permission: string): ProjectScope {
  const holding = rows.filter((row) => row.permissions.includes(permission));
  const orgDeny = holding.some((row) => row.scope_type === 'organisation' && row.effect === 'deny');
  if (orgDeny) return { all: false, projectIds: [] };
  if (holding.some((row) => row.scope_type === 'organisation' && row.effect === 'allow')) return { all: true };
  const denied = new Set(holding.filter((row) => row.effect === 'deny').map((row) => row.scope_id));
  const allowed = holding.filter((row) => row.effect === 'allow' && !denied.has(row.scope_id)).map((row) => toEntityId<'project'>(row.scope_id));
  return { all: false, projectIds: [...new Set(allowed)] };
}

/**
 * Crée l'adaptateur `AccessPolicy`.
 * @param pool pool PostgreSQL
 * @param clock horloge
 * @returns politique d'accès
 */
export function createAccessPolicy(pool: pg.Pool, clock: Clock): AccessPolicy {
  const read = async (context: ExecutionContext, userId: string): Promise<readonly AssignmentRow[]> =>
    withTransaction(pool, { ...POLICY_SCOPE, organisationId: context.organisationId }, (tx) => assignmentsOf(tx, userId));
  return {
    async authorize(context, request) {
      if (context.actor.kind === 'system') return { allowed: true };
      const rows = await read(context, context.actor.userId);
      return decide(context, request, { grants: grantsFor(rows, request.projectId), now: clock.now() });
    },
    async projectsWith(context, permission) {
      if (context.actor.kind === 'system') return { all: true };
      return scopeOf(await read(context, context.actor.userId), permission);
    },
  };
}
