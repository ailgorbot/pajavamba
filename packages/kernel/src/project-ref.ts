/**
 * Référence de projet reçue dans une URL : identifiant public (base58), UUID ou clé (§10.3).
 *
 * Couche : noyau. Règles : RG-PRJ-001 (format de clé), §6.3.
 */
import { publicIdToUuid } from './base58.ts';
import { isUuid, toEntityId, type ProjectId } from './ids.ts';

/** Référence de projet : identifiant ou clé. */
export type ProjectRef = { readonly id: ProjectId } | { readonly key: string };

const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/u;

/**
 * Analyse une référence de projet.
 * @param value valeur reçue
 * @returns référence, ou `undefined` si la forme est invalide
 */
export function parseProjectRef(value: string | undefined): ProjectRef | undefined {
  if (value === undefined) return undefined;
  if (PROJECT_KEY_PATTERN.test(value)) return { key: value };
  const uuid = isUuid(value) ? value : publicIdToUuid(value);
  return uuid === undefined ? undefined : { id: toEntityId(uuid) };
}
