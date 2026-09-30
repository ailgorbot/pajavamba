/**
 * Consommateur des événements d'identity : tient à jour la projection locale des attributions.
 *
 * Couche : moyenne (policy/structure). Règles : RI-SRV-11 (idempotent), RI-SCR-08 (révocation
 * propagée en moins de 5 secondes), RG-IAM-005.
 */
import { EVENT_TYPES, type CloudEvent, type EventConsumer } from '@pajavamba/contracts';
import { consumeOnce, type SqlExecutor } from '@pajavamba/ops';
import type pg from 'pg';
import { POLICY_SCOPE } from '../politique/access-policy.adapter.ts';

/**
 * Lit une chaîne dans les données d'un événement.
 * @param event événement
 * @param key champ
 * @returns valeur textuelle
 */
function text(event: CloudEvent, key: string): string {
  const value = event.data[key];
  return typeof value === 'string' ? value : '';
}

/**
 * Applique un événement à la projection.
 * @param tx transaction
 * @param event événement
 */
async function apply(tx: SqlExecutor, event: CloudEvent): Promise<void> {
  switch (event.type) {
    case EVENT_TYPES.roleAssigned: {
      const permissions = Array.isArray(event.data['permissions']) ? event.data['permissions'].filter((item) => typeof item === 'string') : [];
      await tx.query(
        `INSERT INTO assignments (organisation_id, id, user_id, role_key, scope_type, scope_id, effect, permissions)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
        [event.pvorganisation, event.subject, text(event, 'userId'), text(event, 'roleKey'), text(event, 'scopeType'), text(event, 'scopeId'), text(event, 'effect'), permissions],
      );
      return;
    }
    case EVENT_TYPES.roleRevoked:
      await tx.query('DELETE FROM assignments WHERE id = $1', [event.subject]);
      return;
    case EVENT_TYPES.userDeactivated:
      await tx.query('INSERT INTO inactive_users (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [event.subject]);
      return;
    case EVENT_TYPES.userReactivated:
      await tx.query('DELETE FROM inactive_users WHERE user_id = $1', [event.subject]);
      return;
    case EVENT_TYPES.projectPurged:
      await tx.query("DELETE FROM assignments WHERE scope_type = 'project' AND scope_id = $1", [event.subject]);
      return;
    default:
      return;
  }
}

/**
 * Crée le consommateur de projection.
 * @param pool pool PostgreSQL
 * @returns consommateur
 */
export function createIdentityProjectionConsumer(pool: pg.Pool): EventConsumer {
  return {
    name: 'policy.identity_projection',
    types: [EVENT_TYPES.roleAssigned, EVENT_TYPES.roleRevoked, EVENT_TYPES.userDeactivated, EVENT_TYPES.userReactivated, EVENT_TYPES.projectPurged],
    async handle(event) {
      await consumeOnce({ pool, scope: { ...POLICY_SCOPE, organisationId: event.pvorganisation }, consumer: 'policy.identity_projection', eventId: event.id, correlationId: event.pvcorrelation }, async (tx) => {
        await apply(tx, event);
        return [];
      });
    },
  };
}
