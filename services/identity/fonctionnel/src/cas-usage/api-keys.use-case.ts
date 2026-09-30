/**
 * Cas d'usage de la clé API personnelle : création (ou régénération), révocation, authentification.
 *
 * Couche : basse (identity/fonctionnel). Règles : RI-SCR-03 (empreinte seule, valeur affichée une
 * fois), RI-CNX-05 (la clé n'encode aucun droit), RI-HAB-02 (`api_key:manage_own` est R3), §8.4.
 */
import { domainError, err, ok, requireAccess, type DomainError, type ExecutionContext, type Result, type UseCaseOutput } from '@pajavamba/kernel';
import type { ApiKey, Membership, User } from '../domaine/identity-model.ts';
import { IDENTITY_EVENTS, identityEvent } from '../domaine/identity.events.ts';
import { validateName } from '../domaine/identity.rules.ts';
import type { IdentityDependencies } from '../ports/identity.ports.ts';

const NO_KEY = domainError('identity.api_key_not_found', 'not_found', "Vous n'avez pas de clé API active.");

/** Entrée de la création d'une clé. */
export interface CreateApiKeyInput {
  readonly name: string;
  readonly readOnly: boolean;
}

/**
 * Crée la clé personnelle de l'utilisateur ; toute clé existante est révoquée (régénération).
 * @param dependencies dépendances
 * @param context contexte d'exécution
 * @param input nom et option de lecture seule
 * @returns jeton (affiché une seule fois) et métadonnées
 */
export async function createApiKey(dependencies: IdentityDependencies, context: ExecutionContext, input: CreateApiKeyInput): Promise<Result<UseCaseOutput<{ readonly token: string; readonly key: ApiKey }>, DomainError>> {
  const access = await requireAccess(dependencies.policy, context, { permission: 'api_key:manage_own', risk: 'R3' });
  if (!access.ok || context.actor.kind !== 'user') return access.ok ? err(NO_KEY) : access;
  const name = validateName(input.name);
  if (!name.ok) return name;
  const userId = context.actor.userId;
  const now = dependencies.clock.now();
  await dependencies.credentials.revokeKeysOf(userId, now);
  const issued = dependencies.secrets.issueApiKey();
  const key: ApiKey = { id: dependencies.ids.next(), userId, publicId: issued.publicId, name: name.value, readOnly: input.readOnly, createdAt: now, lastUsedAt: null, revokedAt: null };
  await dependencies.credentials.insertKey(key, issued.hash);
  return ok({ result: { token: issued.value, key }, events: [identityEvent(IDENTITY_EVENTS.apiKeyCreated, key.id, { userId, publicId: key.publicId, readOnly: key.readOnly })] });
}

/**
 * Révoque la clé personnelle de l'utilisateur courant.
 * @param dependencies dépendances
 * @param context contexte d'exécution
 * @returns événements
 */
export async function revokeApiKey(dependencies: IdentityDependencies, context: ExecutionContext): Promise<Result<UseCaseOutput<null>, DomainError>> {
  const access = await requireAccess(dependencies.policy, context, { permission: 'api_key:manage_own', risk: 'R3' });
  if (!access.ok) return access;
  const key = context.actor.kind === 'user' ? await dependencies.credentials.findActiveKeyOf(context.actor.userId) : undefined;
  if (key === undefined) return err(NO_KEY);
  await dependencies.credentials.revokeKey(key.id, dependencies.clock.now());
  return ok({ result: null, events: [identityEvent(IDENTITY_EVENTS.apiKeyRevoked, key.id, { userId: key.userId, publicId: key.publicId })] });
}

/** Clé authentifiée. */
export interface AuthenticatedKey {
  readonly key: ApiKey;
  readonly user: User;
  readonly membership: Membership;
}

/**
 * Authentifie une clé : identifiant public, empreinte, révocation, utilisateur actif (§8.8).
 * @param dependencies dépendances
 * @param publicId identifiant public extrait du jeton (somme de contrôle déjà vérifiée)
 * @param token jeton brut
 * @returns clé authentifiée ou `undefined`
 */
export async function authenticateApiKey(dependencies: IdentityDependencies, publicId: string, token: string): Promise<AuthenticatedKey | undefined> {
  const key = await dependencies.credentials.findKeyByPublicId(publicId);
  if (key === undefined || key.revokedAt !== null || !dependencies.secrets.sameHash(key.secretHash, dependencies.secrets.hashSecret(token))) return undefined;
  const user = await dependencies.users.findById(key.userId);
  if (user?.status !== 'active') return undefined;
  const membership = await dependencies.organisations.firstActiveMembership(user.id);
  if (membership === undefined) return undefined;
  await dependencies.credentials.touchKey(key.id, dependencies.clock.now());
  return { key, user, membership };
}
