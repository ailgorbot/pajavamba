/**
 * Consommateur des événements de portfolio : rôle d'administrateur de projet pour le créateur,
 * retrait des attributions d'un projet purgé.
 *
 * Couche : moyenne (identity/structure). Règles : RI-SRV-04 (saga, aucune transaction distribuée),
 * RI-SRV-11 (idempotent), RG-PRJ-007.
 */
import { EVENT_TYPES, type CloudEvent, type EventConsumer } from '@pajavamba/contracts';
import { grantCreatorRole } from '@pajavamba/identity-fonctionnel';
import { toEntityId, type ExecutionContext } from '@pajavamba/kernel';
import { consumeOnce, type OutboxMessage } from '@pajavamba/ops';
import { IDENTITY_SCOPE, type IdentityRuntime } from '../composition/identity-runtime.ts';

const CONSUMER = 'identity.project_roles';

/**
 * Contexte système d'une réaction à un événement.
 * @param event événement
 * @returns contexte
 */
function systemContext(event: CloudEvent): ExecutionContext {
  return { organisationId: toEntityId(event.pvorganisation), actor: { kind: 'system' }, channel: 'system', credential: { kind: 'internal' }, correlationId: toEntityId(event.pvcorrelation) };
}

/**
 * Crée le consommateur.
 * @param runtime environnement identity
 * @returns consommateur
 */
export function createProjectRolesConsumer(runtime: IdentityRuntime): EventConsumer {
  return {
    name: CONSUMER,
    types: [EVENT_TYPES.projectCreated, EVENT_TYPES.projectPurged],
    async handle(event) {
      await consumeOnce({ pool: runtime.pool, scope: { ...IDENTITY_SCOPE, organisationId: event.pvorganisation }, consumer: CONSUMER, eventId: event.id, correlationId: event.pvcorrelation }, async (tx): Promise<readonly OutboxMessage[]> => {
        if (event.type === EVENT_TYPES.projectPurged) {
          await tx.query("DELETE FROM role_assignments WHERE scope_type = 'project' AND scope_id = $1", [event.subject]);
          return [];
        }
        const creator = event.pvactor;
        if (creator === null) return [];
        const outcome = await grantCreatorRole(runtime.dependenciesOf(tx), systemContext(event), toEntityId(event.subject), toEntityId(creator));
        if (!outcome.ok) return [];
        return outcome.value.events.map((domainEvent) => ({ kind: 'event', type: domainEvent.type, aggregateId: domainEvent.aggregateId, aggregateVersion: domainEvent.aggregateVersion, payload: domainEvent.data }));
      });
    },
  };
}
