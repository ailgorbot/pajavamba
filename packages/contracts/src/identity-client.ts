/**
 * Contrat du client `identity` utilisé par la passerelle pour authentifier les requêtes.
 *
 * Couche : contrats. Règles : RI-SRV-02 (aucun import de code entre services), RI-SRV-09
 * (appel intra-unité par le client du contrat), RI-CNX-05 (droits recalculés à chaque appel).
 */
import type { Credential, OrganisationId, UserId } from '@pajavamba/kernel';

/** Principal authentifié par la passerelle. */
export interface AuthenticatedPrincipal {
  readonly userId: UserId;
  readonly organisationId: OrganisationId;
  readonly credential: Credential;
  /** Jeton CSRF attendu pour les requêtes modifiantes authentifiées par cookie. */
  readonly csrfToken: string | null;
}

/** Client du service `identity`. */
export interface IdentityClient {
  /**
   * Authentifie un secret de session (cookie) ; `undefined` si invalide, expiré ou révoqué.
   * @param sessionSecret secret brut lu dans le cookie
   */
  authenticateSession(sessionSecret: string): Promise<AuthenticatedPrincipal | undefined>;
  /**
   * Authentifie une clé API personnelle `pvb_key_…` ; `undefined` si invalide ou révoquée.
   * @param token jeton brut lu dans l'en-tête `Authorization`
   */
  authenticateApiKey(token: string): Promise<AuthenticatedPrincipal | undefined>;
}
