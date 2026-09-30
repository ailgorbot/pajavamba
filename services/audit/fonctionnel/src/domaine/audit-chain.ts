/**
 * Journal d'audit chaîné : chaque entrée porte l'empreinte de la précédente ; la chaîne est
 * vérifiable de bout en bout.
 *
 * Couche : basse (audit/fonctionnel). Règles : RI-AUD-02 (chaîné, vérifiable, en lecture seule),
 * RI-AUD-04 (aucune valeur D, S ou X en clair : noms de champs uniquement).
 */

/** Empreinte d'une chaîne (port : SHA-256 fourni par la couche moyenne). */
export type Hasher = (input: string) => string;

/** Contenu d'une entrée d'audit. */
export interface AuditContent {
  readonly occurredAt: string;
  readonly actorType: string;
  readonly actorId: string | null;
  readonly channel: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly decision: 'allow' | 'deny';
  readonly correlationId: string;
  readonly changedFields: readonly string[];
}

/** Entrée chaînée. */
export interface ChainedEntry {
  readonly seq: number;
  readonly content: AuditContent;
  readonly prevHash: string;
  readonly hash: string;
}

/** Empreinte initiale d'une chaîne vide. */
export const GENESIS_HASH = '0'.repeat(64);

/**
 * Sérialisation canonique (clés triées) d'un contenu d'audit.
 * @param content contenu
 * @returns chaîne canonique
 */
export function canonical(content: AuditContent): string {
  const entries = Object.entries(content).sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify(Object.fromEntries(entries));
}

/**
 * Calcule l'empreinte d'une entrée à partir de la précédente.
 * @param hasher fonction d'empreinte
 * @param prevHash empreinte précédente
 * @param content contenu
 * @returns empreinte
 */
export function chainHash(hasher: Hasher, prevHash: string, content: AuditContent): string {
  return hasher(`${prevHash}|${canonical(content)}`);
}

/**
 * Vérifie une suite d'entrées consécutives.
 * @param hasher fonction d'empreinte
 * @param entries entrées ordonnées
 * @param startHash empreinte précédant la première entrée
 * @returns numéro de la première entrée invalide, ou `null` si la chaîne est intègre
 */
export function verifyChain(hasher: Hasher, entries: readonly ChainedEntry[], startHash: string): number | null {
  let previous = startHash;
  for (const entry of entries) {
    if (entry.prevHash !== previous || entry.hash !== chainHash(hasher, previous, entry.content)) return entry.seq;
    previous = entry.hash;
  }
  return null;
}
