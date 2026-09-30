/**
 * Erreurs standardisées au format RFC 9457 (Problem Details), en français.
 *
 * Couche : haute (OPS). Règles : RI-API-04 (aucun détail interne ni trace de pile), RI-ERG-04, §10.4.
 */

/** Erreur de champ reliée par pointeur JSON. */
export interface FieldError {
  readonly pointer: string;
  readonly code: string;
  readonly message: string;
}

/** Message destiné à l'outbox écrit même si la requête échoue (audit d'un refus). */
export interface FailureOutboxMessage {
  readonly kind: 'audit';
  readonly type: string;
  readonly aggregateId: string;
  readonly payload: unknown;
}

/** Paramètres d'un problème HTTP. */
export interface HttpProblemInit {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string;
  readonly errors?: readonly FieldError[];
  /** Entrées d'audit à écrire malgré l'échec (RI-HAB-12). */
  readonly auditOnFailure?: readonly FailureOutboxMessage[];
}

/** Problème HTTP levé par la couche moyenne et converti par le serveur OPS. */
export class HttpProblem extends Error {
  readonly init: HttpProblemInit;

  /**
   * @param init statut, code stable, titre et détail en français
   */
  constructor(init: HttpProblemInit) {
    super(init.code);
    this.init = init;
  }
}

/** Corps RFC 9457 renvoyé au client. */
export interface ProblemBody {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly instance: string;
  readonly code: string;
  readonly errors?: readonly FieldError[];
}

/** Base des pages de documentation des codes d'erreur. */
export const ERROR_DOC_BASE = 'https://ailgorbot.github.io/pajavamba/reference/erreurs/';

/**
 * Construit le corps RFC 9457 d'un problème.
 * @param init problème
 * @param requestId identifiant de corrélation
 * @returns corps sérialisable
 */
export function toProblemBody(init: HttpProblemInit, requestId: string): ProblemBody {
  const body: ProblemBody = {
    type: `${ERROR_DOC_BASE}${init.code}`,
    title: init.title,
    status: init.status,
    detail: init.detail,
    instance: `urn:pv:request:${requestId}`,
    code: init.code,
  };
  return init.errors === undefined ? body : { ...body, errors: init.errors };
}

/** Problème technique générique : aucun détail interne n'est exposé. */
export const INTERNAL_PROBLEM: HttpProblemInit = {
  status: 500,
  code: 'ops.internal_error',
  title: 'Erreur interne',
  detail: "Une erreur technique est survenue. Réessayez ; si le problème persiste, communiquez l'identifiant de la requête au support.",
};
