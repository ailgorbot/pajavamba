/**
 * Identifiants typés du noyau partagé.
 *
 * Couche : noyau (`packages/kernel`), sans aucune dépendance.
 * Règles : RI-COD-04 (tout identifiant est typé), RI-DON-06 (UUIDv7 générés par l'application).
 */

/** Identifiant typé : une chaîne marquée par le concept qu'elle désigne. */
export type EntityId<K extends string> = string & { readonly __entity: K };

/** Identifiant d'organisation (locataire, périmètre RLS). */
export type OrganisationId = EntityId<'organisation'>;
/** Identifiant d'utilisateur. */
export type UserId = EntityId<'user'>;
/** Identifiant de projet. */
export type ProjectId = EntityId<'project'>;
/** Identifiant de corrélation d'une requête (en-tête `X-Request-Id`). */
export type CorrelationId = EntityId<'correlation'>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/**
 * Vérifie qu'une chaîne est un UUID canonique en minuscules.
 * @param value chaîne à contrôler
 * @returns vrai si la chaîne est un UUID
 */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Marque une chaîne déjà validée comme identifiant d'un concept.
 * Seul point de conversion : l'appelant garantit la validité de la valeur
 * (UUID produit par le générateur ou relu en base).
 * @param value UUID validé
 * @returns l'identifiant typé
 */
export function toEntityId<K extends string>(value: string): EntityId<K> {
  // Conversion justifiée : un type marqué ne peut être construit que par assertion.
  return value as EntityId<K>;
}
