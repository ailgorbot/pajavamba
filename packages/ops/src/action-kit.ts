/**
 * Outils génériques des gestionnaires d'actions : validation fermée, contexte exigé, empreinte.
 *
 * Couche : haute (OPS), sans connaissance métier. Règles : RI-COD-12 (Zod, schémas fermés),
 * RI-SEC-04 (authentification exigée hors actions publiques), RI-API-05.
 */
import type { z } from 'zod';
import { validationProblem } from './domain-problem.ts';
import { HttpProblem } from './problem.ts';
import { sha256Hex } from './secrets.ts';

/**
 * Valide une entrée avec un schéma Zod fermé ; lève un problème 422 détaillé sinon.
 * @param schema schéma (objet strict)
 * @param value valeur reçue
 * @returns valeur typée
 */
export function parseInput<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value ?? {});
  if (!parsed.success) {
    throw validationProblem(parsed.error.issues);
  }
  return parsed.data;
}

/** Problème d'absence d'authentification. */
export const UNAUTHENTICATED = new HttpProblem({ status: 401, code: 'ops.unauthenticated', title: 'Authentification requise', detail: 'Connectez-vous ou fournissez une clé API valide.' });

/**
 * Exige un contexte d'exécution authentifié.
 * @param context contexte éventuel
 * @returns contexte
 */
export function requireContext<C>(context: C | undefined): C {
  if (context === undefined) {
    throw UNAUTHENTICATED;
  }
  return context;
}

/**
 * Empreinte d'une requête pour le contrôle des clés d'idempotence.
 * @param params paramètres de chemin
 * @param body corps
 * @returns empreinte SHA-256
 */
export function requestHashOf(params: unknown, body: unknown): string {
  return sha256Hex(JSON.stringify({ params, body }));
}

/**
 * Exige l'en-tête `If-Match` (verrouillage optimiste) et le compare à la version courante.
 * @param ifMatch version attendue par le client
 * @param current version courante
 */
export function checkIfMatch(ifMatch: number | null, current: number): void {
  if (requireIfMatch(ifMatch) !== current) {
    throw new HttpProblem({ status: 412, code: 'ops.version_mismatch', title: 'Version périmée', detail: 'La ressource a été modifiée entre-temps. Rechargez-la puis réessayez.' });
  }
}

/**
 * Exige la présence de l'en-tête `If-Match` (RI-API-05).
 * @param ifMatch version transmise
 * @returns version attendue
 */
export function requireIfMatch(ifMatch: number | null): number {
  if (ifMatch === null) {
    throw new HttpProblem({ status: 428, code: 'ops.if_match_required', title: 'En-tête If-Match requis', detail: "Fournissez l'en-tête If-Match avec la version (ETag) de la ressource." });
  }
  return ifMatch;
}
