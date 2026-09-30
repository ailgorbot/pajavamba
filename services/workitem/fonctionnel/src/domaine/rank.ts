/**
 * Rang lexicographique du backlog : insertion entre deux rangs sans renuméroter les voisins.
 *
 * Couche : basse (workitem/fonctionnel). Référence : §6.5.3 (`rank`).
 */

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length;
const MIN_DIGIT = 0;
const MAX_DIGIT = BASE - 1;
const HALF = 2;

/**
 * Valeur d'un chiffre du rang (0 au-delà de la fin pour la borne basse).
 * @param rank rang
 * @param index position
 * @param fallback valeur au-delà de la fin
 * @returns valeur du chiffre
 */
function digitAt(rank: string, index: number, fallback: number): number {
  return index < rank.length ? DIGITS.indexOf(rank.charAt(index)) : fallback;
}

/**
 * Calcule un rang strictement compris entre deux rangs (bornes ouvertes si `null`).
 * @param before rang précédent ou `null`
 * @param after rang suivant ou `null`
 * @returns rang intermédiaire
 */
export function rankBetween(before: string | null, after: string | null): string {
  const low = before ?? '';
  const high = after;
  let prefix = '';
  for (let index = 0; ; index += 1) {
    const lowDigit = digitAt(low, index, MIN_DIGIT);
    const highDigit = high === null ? BASE : digitAt(high, index, BASE);
    if (highDigit - lowDigit > 1) {
      return `${prefix}${DIGITS.charAt(Math.floor((lowDigit + highDigit) / HALF))}`;
    }
    prefix += DIGITS.charAt(Math.min(lowDigit, MAX_DIGIT));
  }
}
