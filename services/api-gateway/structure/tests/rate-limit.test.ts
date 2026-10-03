/**
 * Tests de la limitation de débit de l'API.
 *
 * Couche : moyenne (api-gateway). Règles vérifiées : RI-API-11, §10.2.
 */
import { createRateLimiter, HttpProblem } from '@pajavamba/ops';
import type { FastifyReply } from 'fastify';
import { describe, expect, it } from 'vitest';
import { enforceRateLimit, ORGANISATION_FACTOR, rateBuckets, READ_LIMIT, WRITE_LIMIT } from '../src/passerelle/rate-limit.ts';

/**
 * Réponse simulée qui mémorise les en-têtes posés.
 * @returns réponse et en-têtes
 */
function fakeReply(): { reply: FastifyReply; headers: Map<string, string> } {
  const headers = new Map<string, string>();
  const reply = { header: (name: string, value: string) => headers.set(name, value) } as unknown as FastifyReply;
  return { reply, headers };
}

describe('limitation de débit de l’API', () => {
  it('limite un client authentifié et plafonne son organisation', () => {
    expect(rateBuckets({ method: 'POST', ip: 'client-anonyme', userId: 'u1', credentialKind: 'api_key', organisationId: 'o1' })).toEqual([
      { key: 'ecriture:utilisateur:u1:api_key', limit: WRITE_LIMIT },
      { key: 'ecriture:organisation:o1', limit: WRITE_LIMIT * ORGANISATION_FACTOR },
    ]);
  });

  it('limite un client non authentifié par adresse IP', () => {
    expect(rateBuckets({ method: 'GET', ip: 'client-anonyme' })).toEqual([{ key: 'lecture:ip:client-anonyme', limit: READ_LIMIT }]);
  });

  it('pose les en-têtes RateLimit puis refuse avec Retry-After au-delà de la limite', () => {
    const limiter = createRateLimiter(60_000, () => 0);
    const buckets = [{ key: 'ecriture:ip:client-anonyme', limit: 1 }];
    const first = fakeReply();
    enforceRateLimit(limiter, first.reply, buckets);
    expect(first.headers.get('ratelimit-remaining')).toBe('0');
    const second = fakeReply();
    expect(() => enforceRateLimit(limiter, second.reply, buckets)).toThrow(HttpProblem);
    expect(second.headers.get('retry-after')).toBe('60');
  });
});
