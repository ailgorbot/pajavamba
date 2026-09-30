/**
 * Implémentation du contrat `IdentityClient` utilisé par la passerelle (transport en mémoire).
 *
 * Couche : moyenne (identity/structure). Règles : RI-SRV-09, RI-CNX-05, §8.8 (étapes 1 à 4).
 */
import type { AuthenticatedPrincipal, IdentityClient } from '@pajavamba/contracts';
import { authenticateApiKey, authenticateSession } from '@pajavamba/identity-fonctionnel';
import { parseToken, withTransaction } from '@pajavamba/ops';
import { IDENTITY_SCOPE, type IdentityRuntime } from './identity-runtime.ts';

/**
 * Crée le client identity.
 * @param runtime environnement identity
 * @returns client
 */
export function createIdentityClient(runtime: IdentityRuntime): IdentityClient {
  return {
    async authenticateSession(sessionSecret) {
      return withTransaction(runtime.pool, IDENTITY_SCOPE, async (tx): Promise<AuthenticatedPrincipal | undefined> => {
        const authenticated = await authenticateSession(runtime.dependenciesOf(tx), sessionSecret);
        if (authenticated === undefined) return undefined;
        const { session, user } = authenticated;
        return { userId: user.id, organisationId: session.organisationId, credential: { kind: 'session', mfaVerifiedAt: session.mfaVerifiedAt }, csrfToken: session.csrfToken };
      });
    },
    async authenticateApiKey(token) {
      const publicId = parseToken(token, 'key');
      if (publicId === undefined) return undefined;
      return withTransaction(runtime.pool, IDENTITY_SCOPE, async (tx): Promise<AuthenticatedPrincipal | undefined> => {
        const authenticated = await authenticateApiKey(runtime.dependenciesOf(tx), publicId, token);
        if (authenticated === undefined) return undefined;
        return { userId: authenticated.user.id, organisationId: authenticated.membership.organisationId, credential: { kind: 'api_key', readOnly: authenticated.key.readOnly }, csrfToken: null };
      });
    },
  };
}
