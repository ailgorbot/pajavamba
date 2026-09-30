/**
 * Contexte d'exécution transmis explicitement à chaque cas d'usage.
 *
 * Couche : noyau. Règles : RI-ARC-07 (aucun contexte implicite), RI-HAB-04 (délégation).
 */
import type { CorrelationId, OrganisationId, UserId } from './ids.ts';

/** Canal par lequel l'action est demandée. */
export type Channel = 'ui' | 'api' | 'mcp' | 'plugin' | 'system';

/** Acteur à l'origine d'une action. */
export type Actor = { readonly kind: 'user'; readonly userId: UserId } | { readonly kind: 'system' };

/** Moyen d'authentification de la requête, utile aux décisions d'autorisation (§8.8). */
export type Credential =
  | { readonly kind: 'session'; readonly mfaVerifiedAt: number | null }
  | { readonly kind: 'api_key'; readonly readOnly: boolean }
  | { readonly kind: 'internal' };

/** Contexte d'exécution d'un cas d'usage. */
export interface ExecutionContext {
  readonly organisationId: OrganisationId;
  readonly actor: Actor;
  readonly channel: Channel;
  readonly credential: Credential;
  readonly correlationId: CorrelationId;
}

/**
 * Retourne l'identifiant de l'utilisateur acteur, ou `undefined` pour le système.
 * @param context contexte d'exécution
 * @returns identifiant de l'utilisateur
 */
export function actorUserId(context: ExecutionContext): UserId | undefined {
  return context.actor.kind === 'user' ? context.actor.userId : undefined;
}
