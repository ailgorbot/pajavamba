/**
 * Tests du client HTTP sortant : délai, reprises bornées, disjoncteur.
 *
 * Couche : haute (OPS). Règles vérifiées : RI-SRV-12 ; scénario « Le disjoncteur s'ouvre » de L0-23.
 */
import { describe, expect, it } from 'vitest';
import { createHttpClient, isReplayable, type HttpClientDependencies } from '../src/http-client.ts';
import { HttpProblem } from '../src/problem.ts';

const URL_VOISIN = 'https://voisin.exemple.fr/api';
const OPTIONS = { target: 'voisin', timeoutMs: 1_000, retries: 0, breaker: { failureThreshold: 5, openMs: 30_000 } };

/**
 * Prépare des dépendances simulées : chaque appel renvoie le statut suivant de la liste (`null` = erreur réseau).
 * @param statuses statuts successifs
 * @returns dépendances, horloge et compteur d'appels
 */
function simulated(statuses: readonly (number | null)[]): { deps: HttpClientDependencies; clock: { now: number }; calls: () => number } {
  const clock = { now: 0 };
  let count = 0;
  const deps: HttpClientDependencies = {
    fetch: async () => {
      const status = statuses[Math.min(count, statuses.length - 1)] ?? null;
      count += 1;
      if (status === null) throw new TypeError('échec réseau');
      return Promise.resolve(new Response(null, { status }));
    },
    now: () => clock.now,
    sleep: async () => Promise.resolve(),
  };
  return { deps, clock, calls: () => count };
}

describe('client HTTP sortant', () => {
  it('ouvre le disjoncteur après 5 erreurs consécutives et échoue immédiatement avec « system.unavailable »', async () => {
    const { deps, calls } = simulated([500]);
    const client = createHttpClient(OPTIONS, deps);
    for (let index = 0; index < 5; index += 1) expect((await client.request(URL_VOISIN)).status).toBe(500);
    expect(client.state()).toBe('open');
    const error = await client.request(URL_VOISIN).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HttpProblem);
    expect((error as HttpProblem).init.code).toBe('system.unavailable');
    expect(calls()).toBe(5);
  });

  it("laisse passer un appel d'essai après la durée d'ouverture et se referme s'il réussit", async () => {
    const { deps, clock } = simulated([500, 500, 500, 500, 500, 200]);
    const client = createHttpClient(OPTIONS, deps);
    for (let index = 0; index < 5; index += 1) await client.request(URL_VOISIN);
    clock.now = 30_000;
    expect(client.state()).toBe('half-open');
    expect((await client.request(URL_VOISIN)).status).toBe(200);
    expect(client.state()).toBe('closed');
  });

  it('rejoue une lecture en échec dans la limite des reprises', async () => {
    const { deps, calls } = simulated([null, 503, 200]);
    const client = createHttpClient({ ...OPTIONS, retries: 2 }, deps);
    expect((await client.request(URL_VOISIN)).status).toBe(200);
    expect(calls()).toBe(3);
  });

  it("ne rejoue jamais une écriture sans clé d'idempotence", async () => {
    const { deps, calls } = simulated([null]);
    const client = createHttpClient({ ...OPTIONS, retries: 3 }, deps);
    await expect(client.request(URL_VOISIN, { method: 'POST' })).rejects.toBeInstanceOf(HttpProblem);
    expect(calls()).toBe(1);
  });

  it("considère rejouables les méthodes idempotentes et les écritures munies d'une clé d'idempotence", () => {
    expect(isReplayable(undefined)).toBe(true);
    expect(isReplayable({ method: 'POST' })).toBe(false);
    expect(isReplayable({ method: 'POST', headers: { 'Idempotency-Key': 'cle' } })).toBe(true);
  });
});
