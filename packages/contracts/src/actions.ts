/**
 * Registre d'actions : chaque action est déclarée une seule fois ; les routes REST sont générées
 * par la passerelle à partir de ces déclarations, la documentation de référence aussi.
 *
 * Couche : contrats. Règles : RI-API-01 (registre unique), RI-HAB-01, RI-HAB-07 (niveau jamais
 * assoupli sous le catalogue), RI-ARC-06 (une action = un cas d'usage), RI-MET-08.
 */
import type { ExecutionContext, RiskLevel } from '@pajavamba/kernel';
import { riskOf, type Permission } from './permissions.ts';

/** Méthode HTTP de la route générée pour l'action. */
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/**
 * Accès exigé : permission du catalogue, `self` (tout utilisateur authentifié agissant sur ses
 * propres ressources) ou `public` (connexion et initialisation uniquement, RI-SEC-04).
 */
export type ActionAccess = Permission | 'self' | 'public';

/** Déclaration d'une action du registre. */
export interface ActionDefinition {
  /** Identifiant `<ressource>.<action>`. */
  readonly id: string;
  readonly permission: ActionAccess;
  readonly risk: RiskLevel;
  readonly method: HttpMethod;
  /** Chemin sous `/api/v1`, paramètres au format `:nom`. */
  readonly path: string;
  readonly reversible: boolean;
  readonly description: string;
  /** Règles de gestion appliquées (RG-…). */
  readonly rules: readonly string[];
}

const RISK_ORDER: Readonly<Record<RiskLevel, number>> = { R0: 0, R1: 1, R2: 2, R3: 3 };

/**
 * Déclare une action ; refuse un niveau de risque inférieur à celui de la permission (RI-HAB-07).
 * @param definition déclaration de l'action
 * @returns la déclaration validée
 */
export function defineAction(definition: ActionDefinition): ActionDefinition {
  const access = definition.permission;
  if (access !== 'self' && access !== 'public' && RISK_ORDER[definition.risk] < RISK_ORDER[riskOf(access)]) {
    throw new Error(`Niveau de risque de ${definition.id} inférieur à celui de ${access}`);
  }
  return definition;
}

/** En-têtes d'écriture normalisés par la passerelle. */
export interface WriteHeaders {
  readonly idempotencyKey: string | null;
  readonly ifMatch: number | null;
  readonly dryRun: boolean;
}

/** Appel d'une action, préparé par la passerelle après authentification. */
export interface ActionCall {
  /** Contexte d'exécution ; `undefined` pour une action publique. */
  readonly context: ExecutionContext | undefined;
  readonly params: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly headers: WriteHeaders;
  /** Secret du cookie de session, transmis aux seules actions de session. */
  readonly sessionSecret: string | null;
  readonly clientIp: string;
  readonly userAgent: string;
  /** Identifiant de corrélation de la requête. */
  readonly correlationId: string;
}

/** Cookie de session à poser ou à effacer par la passerelle. */
export type SessionCookie = { readonly set: string; readonly maxAgeSeconds: number } | { readonly clear: true };

/** Réponse d'une action. */
export interface ActionResponse {
  readonly status: number;
  readonly body: unknown;
  /** Version d'agrégat exposée en `ETag`. */
  readonly etag?: number;
  readonly sessionCookie?: SessionCookie;
}

/** Action enregistrée : déclaration et gestionnaire de la couche moyenne. */
export interface RegisteredAction {
  readonly definition: ActionDefinition;
  handle(call: ActionCall): Promise<ActionResponse>;
}
