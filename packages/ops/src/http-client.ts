/**
 * Client HTTP sortant d'OPS : délai par tentative, reprises bornées des seules requêtes rejouables et disjoncteur,
 * afin qu'un service voisin lent ou en panne ne propage pas sa lenteur (§4.6).
 *
 * Couche : haute (OPS). Règles : RI-SRV-12 (tout appel sortant passe par ce client), RI-PRF-04.
 */
import { HttpProblem } from './problem.ts';

/** Paramètres du disjoncteur. */
export interface BreakerOptions {
  /** Nombre d'appels en échec consécutifs qui ouvrent le disjoncteur. */
  readonly failureThreshold: number;
  /** Durée d'ouverture avant un appel d'essai (millisecondes). */
  readonly openMs: number;
}

/** Paramètres du client. */
export interface HttpClientOptions {
  /** Nom du service appelé, repris dans les erreurs. */
  readonly target: string;
  readonly timeoutMs: number;
  /** Reprises après la première tentative (bornées à 3). */
  readonly retries: number;
  readonly breaker: BreakerOptions;
}

/** Dépendances substituables (tests). */
export interface HttpClientDependencies {
  readonly fetch: typeof fetch;
  readonly now: () => number;
  readonly sleep: (ms: number) => Promise<void>;
}

/** État observable du disjoncteur. */
export type BreakerState = 'closed' | 'open' | 'half-open';

/** Client HTTP résilient. */
export interface HttpClient {
  request(url: string, init?: RequestInit): Promise<Response>;
  state(): BreakerState;
}

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 100;
const REPLAYABLE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);

const DEFAULT_DEPENDENCIES: HttpClientDependencies = {
  fetch: (input, init) => fetch(input, init),
  now: () => Date.now(),
  sleep: async (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * Erreur renvoyée quand le service voisin est indisponible (disjoncteur ouvert, délai dépassé, réseau).
 * @param target service appelé
 * @returns problème 503
 */
export function unavailable(target: string): HttpProblem {
  return new HttpProblem({ status: 503, code: 'system.unavailable', title: 'Service momentanément indisponible', detail: `Le service « ${target} » ne répond pas. Réessayez dans quelques instants.` });
}

/**
 * Indique si une requête peut être rejouée sans double effet.
 * @param init requête
 * @returns vrai pour une méthode idempotente ou une écriture munie d'une clé d'idempotence
 */
export function isReplayable(init: RequestInit | undefined): boolean {
  const method = (init?.method ?? 'GET').toUpperCase();
  return REPLAYABLE_METHODS.has(method) || new Headers(init?.headers).has('idempotency-key');
}

/**
 * Disjoncteur : s'ouvre après un nombre d'échecs consécutifs, laisse passer un appel d'essai après la durée d'ouverture.
 * @param options seuil et durée
 * @param now horloge
 * @returns opérations du disjoncteur
 */
function createBreaker(options: BreakerOptions, now: () => number): { state: () => BreakerState; success: () => void; failure: () => void } {
  let failures = 0;
  let openedAt: number | null = null;
  const state = (): BreakerState => {
    if (openedAt === null) return 'closed';
    return now() - openedAt >= options.openMs ? 'half-open' : 'open';
  };
  const success = (): void => {
    failures = 0;
    openedAt = null;
  };
  const failure = (): void => {
    failures += 1;
    if (state() === 'half-open' || failures >= options.failureThreshold) openedAt = now();
  };
  return { state, success, failure };
}

/**
 * Exécute une tentative bornée par le délai ; une réponse 5xx ou une erreur réseau compte comme un échec.
 * @param dependencies dépendances
 * @param url adresse
 * @param init requête et délai
 * @returns réponse, ou `null` en cas d'erreur réseau ou de délai dépassé
 */
async function attempt(dependencies: HttpClientDependencies, url: string, init: RequestInit & { readonly timeoutMs: number }): Promise<Response | null> {
  try {
    return await dependencies.fetch(url, { ...init, signal: AbortSignal.timeout(init.timeoutMs) });
  } catch {
    return null;
  }
}

/**
 * Crée un client HTTP sortant résilient.
 * @param options délai, reprises et disjoncteur
 * @param dependencies dépendances substituables
 * @returns client
 */
export function createHttpClient(options: HttpClientOptions, dependencies: HttpClientDependencies = DEFAULT_DEPENDENCIES): HttpClient {
  const breaker = createBreaker(options.breaker, dependencies.now);
  const retries = Math.min(Math.max(options.retries, 0), MAX_RETRIES);
  const request = async (url: string, init?: RequestInit): Promise<Response> => {
    if (breaker.state() === 'open') throw unavailable(options.target);
    const tries = isReplayable(init) ? retries + 1 : 1;
    let last: Response | null = null;
    for (let index = 0; index < tries; index += 1) {
      if (index > 0) await dependencies.sleep(BACKOFF_BASE_MS * 2 ** (index - 1));
      last = await attempt(dependencies, url, { ...init, timeoutMs: options.timeoutMs });
      if (last !== null && last.status < 500) {
        breaker.success();
        return last;
      }
    }
    breaker.failure();
    if (last === null) throw unavailable(options.target);
    return last;
  };
  return { request, state: breaker.state };
}
