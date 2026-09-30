/**
 * Identifiants publics : encodage base58 (alphabet Bitcoin) d'un UUID sur 22 caractères.
 *
 * Couche : noyau. Règle : §6.3 des spécifications (identifiant public exposé en API et URL).
 */

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE = 58n;
const PUBLIC_ID_LENGTH = 22;
const UUID_HEX_LENGTH = 32;
const HEX_RADIX = 16;
const PUBLIC_ID_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{22}$/u;

/**
 * Encode un UUID en identifiant public base58 de 22 caractères.
 * @param uuid UUID canonique
 * @returns identifiant public
 */
export function uuidToPublicId(uuid: string): string {
  let value = BigInt(`0x${uuid.replaceAll('-', '')}`);
  let encoded = '';
  while (value > 0n) {
    encoded = `${ALPHABET.charAt(Number(value % BASE))}${encoded}`;
    value /= BASE;
  }
  return encoded.padStart(PUBLIC_ID_LENGTH, ALPHABET.charAt(0));
}

/**
 * Décode un identifiant public base58 en UUID ; retourne `undefined` si la forme est invalide.
 * @param publicId identifiant public
 * @returns UUID canonique ou `undefined`
 */
export function publicIdToUuid(publicId: string): string | undefined {
  if (!PUBLIC_ID_PATTERN.test(publicId)) {
    return undefined;
  }
  let value = 0n;
  for (const char of publicId) {
    value = value * BASE + BigInt(ALPHABET.indexOf(char));
  }
  const hex = value.toString(HEX_RADIX);
  if (hex.length > UUID_HEX_LENGTH) {
    return undefined;
  }
  const full = hex.padStart(UUID_HEX_LENGTH, '0');
  return `${full.slice(0, 8)}-${full.slice(8, 12)}-${full.slice(12, 16)}-${full.slice(16, 20)}-${full.slice(20)}`;
}
