/**
 * Limitation de débit par fenêtre fixe, en mémoire de l'unité : un compteur par clé (client, organisation) et par
 * minute. Suffisant tant que les services tournent dans une seule unité (`pv-app`) ; un magasin partagé deviendra
 * nécessaire avec plusieurs instances.
 *
 * Couche : haute (OPS). Règles : RI-API-11 (limites de débit), RI-PRF-05, §4.6.
 */
import { HttpProblem } from './problem.ts';

/** Décision pour une requête. */
export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  /** Secondes avant la réouverture de la fenêtre. */
  readonly resetSeconds: number;
}

/** Limiteur de débit. */
export interface RateLimiter {
  consume(key: string, limit: number): RateLimitDecision;
}

/** Au-delà de ce nombre de compteurs, les fenêtres expirées sont purgées. */
const PRUNE_THRESHOLD = 10_000;

/**
 * Crée un limiteur à fenêtre fixe.
 * @param windowMs durée de la fenêtre (une minute par défaut)
 * @param now horloge
 * @returns limiteur
 */
export function createRateLimiter(windowMs = 60_000, now: () => number = () => Date.now()): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();
  const prune = (at: number): void => {
    if (windows.size < PRUNE_THRESHOLD) return;
    for (const [key, window] of windows) if (at - window.start >= windowMs) windows.delete(key);
  };
  const consume = (key: string, limit: number): RateLimitDecision => {
    const at = now();
    prune(at);
    const current = windows.get(key);
    const window = current === undefined || at - current.start >= windowMs ? { start: at, count: 0 } : current;
    windows.set(key, window);
    const allowed = window.count < limit;
    if (allowed) window.count += 1;
    return { allowed, limit, remaining: Math.max(limit - window.count, 0), resetSeconds: Math.ceil((window.start + windowMs - at) / 1000) };
  };
  return { consume };
}

/**
 * Erreur renvoyée quand la limite de débit est atteinte.
 * @returns problème 429 du catalogue
 */
export function rateLimited(): HttpProblem {
  return new HttpProblem({
    status: 429,
    code: 'request.rate_limited',
    title: 'Trop de requêtes',
    detail: 'La limite de débit est atteinte. Réessayez après le délai indiqué par l’en-tête Retry-After.',
  });
}
