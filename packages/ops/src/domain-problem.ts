/**
 * Conversion générique d'une erreur métier (code, nature, message) en problème HTTP.
 *
 * Couche : haute (OPS). Aucune connaissance métier : seule la nature de l'erreur est interprétée.
 * Règles : RI-API-04, RI-SEC-03 (ressource inaccessible = inexistante), §10.4.
 */
import { HttpProblem, type FailureOutboxMessage } from './problem.ts';

/** Forme structurelle d'une erreur métier. */
export interface DomainErrorShape {
  readonly code: string;
  readonly kind: 'not_found' | 'conflict' | 'forbidden' | 'validation' | 'precondition';
  readonly message: string;
}

/** Statut HTTP de chaque nature d'erreur métier (repris par la référence générée des erreurs). */
export const STATUS_BY_KIND: Readonly<Record<DomainErrorShape['kind'], number>> = {
  not_found: 404,
  conflict: 409,
  forbidden: 403,
  validation: 422,
  precondition: 412,
};

const TITLE_BY_KIND: Readonly<Record<DomainErrorShape['kind'], string>> = {
  not_found: 'Ressource introuvable',
  conflict: 'Règle de gestion non respectée',
  forbidden: 'Action non autorisée',
  validation: 'Données invalides',
  precondition: 'Version périmée',
};

/**
 * Construit le problème HTTP correspondant à une erreur métier.
 * @param error erreur métier
 * @param auditOnFailure entrées d'audit à écrire malgré l'échec
 * @returns problème à lever
 */
export function problemFromDomainError(error: DomainErrorShape, auditOnFailure: readonly FailureOutboxMessage[] = []): HttpProblem {
  return new HttpProblem({
    status: STATUS_BY_KIND[error.kind],
    code: error.code,
    title: TITLE_BY_KIND[error.kind],
    detail: error.message,
    auditOnFailure,
  });
}

/**
 * Problème de validation d'entrée (schéma fermé) avec pointeurs vers les champs.
 * @param issues champs en erreur (chemin et message)
 * @returns problème 422
 */
export function validationProblem(issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[]): HttpProblem {
  return new HttpProblem({
    status: 422,
    code: 'ops.validation_failed',
    title: 'Données invalides',
    detail: 'Certaines données sont invalides. Corrigez les champs signalés puis réessayez.',
    errors: issues.map((issue) => ({ pointer: `/${issue.path.map(String).join('/')}`, code: 'invalid_value', message: issue.message })),
  });
}
