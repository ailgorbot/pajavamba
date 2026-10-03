/**
 * Limitation de débit de l'API : par client (utilisateur et type d'accès, ou adresse IP sans authentification) et
 * plafond par organisation, séparément pour les lectures et les écritures. En-têtes `RateLimit-*` sur chaque
 * réponse, `Retry-After` en cas de refus.
 *
 * Couche : moyenne (api-gateway). Règles : RI-API-11, §10.2 (600 lectures et 120 écritures par minute et par
 * client, plafonds par organisation), §4.6.
 */
import { rateLimited, type RateLimiter } from '@pajavamba/ops';
import type { FastifyReply } from 'fastify';

/** Lectures par minute et par client. */
export const READ_LIMIT = 600;
/** Écritures par minute et par client. */
export const WRITE_LIMIT = 120;
/** Plafond d'une organisation, en multiple de la limite d'un client. */
export const ORGANISATION_FACTOR = 10;

/** Ce qui identifie l'émetteur d'une requête. */
export interface RateSubject {
  readonly method: string;
  readonly ip: string;
  readonly userId?: string;
  readonly credentialKind?: string;
  readonly organisationId?: string;
}

/** Compteur à consommer. */
export interface RateBucket {
  readonly key: string;
  readonly limit: number;
}

/**
 * Compteurs concernés par une requête.
 * @param subject émetteur
 * @returns compteur du client, puis plafond de l'organisation s'il y a lieu
 */
export function rateBuckets(subject: RateSubject): RateBucket[] {
  const kind = subject.method === 'GET' ? 'lecture' : 'ecriture';
  const limit = kind === 'lecture' ? READ_LIMIT : WRITE_LIMIT;
  const client = subject.userId === undefined ? `ip:${subject.ip}` : `utilisateur:${subject.userId}:${subject.credentialKind ?? 'inconnu'}`;
  const buckets = [{ key: `${kind}:${client}`, limit }];
  if (subject.organisationId !== undefined) buckets.push({ key: `${kind}:organisation:${subject.organisationId}`, limit: limit * ORGANISATION_FACTOR });
  return buckets;
}

/**
 * Consomme les compteurs, pose les en-têtes et refuse la requête si un compteur est épuisé.
 * @param limiter limiteur
 * @param reply réponse
 * @param buckets compteurs
 * @throws HttpProblem 429 `request.rate_limited`
 */
export function enforceRateLimit(limiter: RateLimiter, reply: FastifyReply, buckets: readonly RateBucket[]): void {
  const decisions = buckets.map((bucket) => limiter.consume(bucket.key, bucket.limit));
  const refused = decisions.find((decision) => !decision.allowed);
  // En-têtes du compteur le plus contraignant : celui qui refuse, sinon celui qui a le moins de marge.
  const tightest = refused ?? [...decisions].sort((left, right) => left.remaining - right.remaining)[0];
  if (tightest === undefined) return;
  void reply.header('ratelimit-limit', String(tightest.limit));
  void reply.header('ratelimit-remaining', String(tightest.remaining));
  void reply.header('ratelimit-reset', String(tightest.resetSeconds));
  if (refused === undefined) return;
  void reply.header('retry-after', String(refused.resetSeconds));
  throw rateLimited();
}
