/**
 * Tests de la limitation de débit à fenêtre fixe.
 *
 * Couche : haute (OPS). Règles vérifiées : RI-API-11.
 */
import { describe, expect, it } from 'vitest';
import { createRateLimiter, rateLimited } from '../src/rate-limiter.ts';

describe('limitation de débit', () => {
  it('refuse la requête au-delà de la limite dans la fenêtre', () => {
    const clock = { now: 0 };
    const limiter = createRateLimiter(60_000, () => clock.now);
    for (let index = 0; index < 3; index += 1) expect(limiter.consume('client', 3).allowed).toBe(true);
    const refused = limiter.consume('client', 3);
    expect(refused).toEqual({ allowed: false, limit: 3, remaining: 0, resetSeconds: 60 });
  });

  it('rouvre la fenêtre après une minute', () => {
    const clock = { now: 0 };
    const limiter = createRateLimiter(60_000, () => clock.now);
    limiter.consume('client', 1);
    expect(limiter.consume('client', 1).allowed).toBe(false);
    clock.now = 60_000;
    expect(limiter.consume('client', 1).allowed).toBe(true);
  });

  it('compte chaque clé séparément', () => {
    const limiter = createRateLimiter(60_000, () => 0);
    limiter.consume('client-a', 1);
    expect(limiter.consume('client-b', 1).allowed).toBe(true);
  });

  it('renvoie le code 429 du catalogue', () => {
    expect(rateLimited().init).toMatchObject({ status: 429, code: 'request.rate_limited' });
  });
});
