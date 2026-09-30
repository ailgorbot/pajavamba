/**
 * Événements du domaine identity.
 *
 * Couche : basse (identity/fonctionnel). Règles : RI-NOM-07, §5.7 (aucun texte libre ni donnée
 * personnelle inutile dans les événements : identifiants et valeurs énumérées).
 */
import type { DomainEvent, EventValue } from '@pajavamba/kernel';

/** Types d'événements publiés par identity. */
export const IDENTITY_EVENTS = {
  organisationCreated: 'pv.identity.organisation.created.v1',
  userProvisioned: 'pv.identity.user.provisioned.v1',
  userUpdated: 'pv.identity.user.updated.v1',
  userDeactivated: 'pv.identity.user.deactivated.v1',
  userReactivated: 'pv.identity.user.reactivated.v1',
  roleAssigned: 'pv.identity.role.assigned.v1',
  roleRevoked: 'pv.identity.role.revoked.v1',
  sessionOpened: 'pv.identity.session.opened.v1',
  sessionRevoked: 'pv.identity.session.revoked.v1',
  loginFailed: 'pv.identity.login.failed.v1',
  mfaEnrolled: 'pv.identity.mfa.enrolled.v1',
  apiKeyCreated: 'pv.identity.api_key.created.v1',
  apiKeyRevoked: 'pv.identity.api_key.revoked.v1',
} as const;

/**
 * Construit un événement identity.
 * @param type type d'événement
 * @param aggregateId identifiant de l'agrégat
 * @param data données non sensibles
 * @param aggregateVersion version de l'agrégat
 * @returns événement du domaine
 */
export function identityEvent(type: string, aggregateId: string, data: Readonly<Record<string, EventValue>>, aggregateVersion = 1): DomainEvent {
  return { type, aggregateId, aggregateVersion, data };
}
