/**
 * Conversions entre valeurs PostgreSQL et valeurs du domaine (instants en millisecondes).
 *
 * Couche : moyenne (identity/structure).
 */

/**
 * Convertit une date PostgreSQL en millisecondes.
 * @param value date ou `null`
 * @returns millisecondes ou `null`
 */
export function toMillis(value: Date | null): number | null {
  return value === null ? null : value.getTime();
}

/**
 * Convertit des millisecondes en date PostgreSQL.
 * @param value millisecondes ou `null`
 * @returns date ou `null`
 */
export function toDate(value: number | null): Date | null {
  return value === null ? null : new Date(value);
}
