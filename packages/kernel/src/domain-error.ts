/**
 * Erreurs métier de base, converties en RFC 9457 par la couche moyenne.
 *
 * Couche : noyau. Règles : RI-COD-05, RI-NOM-07 (code `<service>.<motif>`), RI-API-04.
 */

/** Nature d'une erreur métier, qui détermine le statut HTTP. */
export type DomainErrorKind = 'not_found' | 'conflict' | 'forbidden' | 'validation' | 'precondition';

/** Erreur métier : code stable, nature et message français. */
export interface DomainError {
  readonly code: string;
  readonly kind: DomainErrorKind;
  readonly message: string;
}

/**
 * Construit une erreur métier.
 * @param code code stable `<service>.<motif>`
 * @param kind nature de l'erreur
 * @param message message français destiné à l'utilisateur
 * @returns l'erreur métier
 */
export function domainError(code: string, kind: DomainErrorKind, message: string): DomainError {
  return { code, kind, message };
}
