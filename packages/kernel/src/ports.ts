/**
 * Ports minimaux communs à toutes les couches basses.
 *
 * Couche : noyau. Règles : RI-ARC-08 (heure et identifiants par ports), RI-ARC-10 (AccessPolicy).
 */
import { domainError, type DomainError } from './domain-error.ts';
import type { ExecutionContext } from './execution-context.ts';
import type { ProjectId } from './ids.ts';
import { err, ok, type Result } from './result.ts';

/** Fournit l'heure courante (interdiction de `Date.now` dans le cœur). */
export interface Clock {
  /** Instant courant en millisecondes depuis l'époque Unix. */
  now(): number;
}

/** Génère des UUIDv7 (interdiction de `crypto` et `Math.random` dans le cœur). */
export interface IdGenerator {
  /** Nouvel UUIDv7. */
  next(): string;
}

/** Niveau de risque d'une action (§7.3). */
export type RiskLevel = 'R0' | 'R1' | 'R2' | 'R3';

/** Demande d'autorisation adressée au port `AccessPolicy`. */
export interface AccessRequest {
  readonly permission: string;
  readonly risk: RiskLevel;
  readonly projectId?: ProjectId;
}

/** Motif d'un refus d'autorisation. */
export type DenialReason = 'no_grant' | 'explicit_deny' | 'r3_requires_ui_mfa' | 'read_only_credential';

/** Décision d'autorisation. */
export type AccessDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: DenialReason };

/** Projets sur lesquels une permission est accordée. */
export type ProjectScope = { readonly all: true } | { readonly all: false; readonly projectIds: readonly ProjectId[] };

/** Port de décision d'autorisation : aucune vérification de droits codée en dur. */
export interface AccessPolicy {
  /**
   * Décide si l'acteur du contexte peut exécuter l'action demandée.
   * @param context contexte d'exécution
   * @param request permission, niveau de risque et portée
   */
  authorize(context: ExecutionContext, request: AccessRequest): Promise<AccessDecision>;
  /**
   * Retourne les projets sur lesquels l'acteur détient une permission (listes filtrées par les droits).
   * @param context contexte d'exécution
   * @param permission permission recherchée
   */
  projectsWith(context: ExecutionContext, permission: string): Promise<ProjectScope>;
}

/** Erreur uniforme de refus d'autorisation. */
export const FORBIDDEN: DomainError = domainError('access.forbidden', 'forbidden', "Vous n'avez pas les droits nécessaires pour cette action.");

/** Erreur de ressource introuvable ou inaccessible (RI-SEC-03). */
export const NOT_FOUND: DomainError = domainError('access.not_found', 'not_found', "La ressource demandée n'existe pas ou n'est pas accessible.");

/**
 * Exige une autorisation ; un refus sur un projet répond comme une ressource inexistante (RI-SEC-03).
 * @param policy port d'autorisation
 * @param context contexte d'exécution
 * @param request demande
 * @returns succès ou erreur de refus
 */
export async function requireAccess(policy: AccessPolicy, context: ExecutionContext, request: AccessRequest): Promise<Result<true, DomainError>> {
  const decision = await policy.authorize(context, request);
  if (decision.allowed) {
    return ok(true);
  }
  return err(FORBIDDEN);
}
