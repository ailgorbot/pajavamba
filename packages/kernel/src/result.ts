/**
 * Type `Result` : les erreurs métier sont des valeurs, jamais des exceptions.
 *
 * Couche : noyau. Règle : RI-COD-05.
 */

/** Succès portant une valeur. */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/** Échec portant une erreur. */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/** Résultat d'une opération pouvant échouer pour une raison métier. */
export type Result<T, E> = Ok<T> | Err<E>;

/**
 * Construit un succès.
 * @param value valeur produite
 * @returns le succès
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Construit un échec.
 * @param error erreur métier
 * @returns l'échec
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}
