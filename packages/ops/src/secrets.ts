/**
 * Primitives de secrets : aléa cryptographique, empreintes, jetons `pvb_`, UUIDv7, hachage argon2id.
 *
 * Couche : haute (OPS). Règles : RI-SCR-02 (format des jetons), RI-SCR-03 (HMAC-SHA-256 + poivre),
 * RI-SCR-09 (générateur sûr), RI-CNX-02 (argon2id), RI-SEC-05 (aucune cryptographie maison), §9.2.
 */
import { hash, verify } from '@node-rs/argon2';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { crc32 } from 'node:zlib';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const TOKEN_PUBLIC_ID_LENGTH = 8;
const TOKEN_SECRET_LENGTH = 43;
const TOKEN_CHECKSUM_LENGTH = 6;
const BYTE_RANGE = 256;
const UUID_BYTES = 16;
const TIMESTAMP_BYTES = 6;
const VERSION_7 = 0x70;
const LOW_NIBBLE = 0x0f;
const VARIANT_RFC = 0x80;
const LOW_SIX_BITS = 0x3f;
const BITS_PER_BYTE = 8;
const ARGON2_MEMORY_KIB = 19_456;
const ARGON2_ITERATIONS = 2;
const ARGON2_ID = 2;

/**
 * Tire une chaîne aléatoire uniforme dans un alphabet (rejet des octets biaisés).
 * @param alphabet alphabet cible
 * @param length longueur voulue
 * @returns chaîne aléatoire
 */
export function randomString(alphabet: string, length: number): string {
  const limit = BYTE_RANGE - (BYTE_RANGE % alphabet.length);
  let output = '';
  while (output.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < limit && output.length < length) {
        output += alphabet.charAt(byte % alphabet.length);
      }
    }
  }
  return output;
}

/**
 * Encode une somme CRC32 en base62 sur 6 caractères.
 * @param input chaîne à contrôler
 * @returns somme de contrôle
 */
function checksum(input: string): string {
  let value = crc32(input);
  let encoded = '';
  while (value > 0) {
    encoded = `${BASE62.charAt(value % BASE62.length)}${encoded}`;
    value = Math.floor(value / BASE62.length);
  }
  return encoded.padStart(TOKEN_CHECKSUM_LENGTH, '0');
}

/** Jeton généré : valeur à afficher une seule fois et identifiant public. */
export interface GeneratedToken {
  readonly value: string;
  readonly publicId: string;
}

/**
 * Génère un jeton `pvb_<type>_<id public>_<secret>_<somme>`.
 * @param type type de jeton (`key`, `prj`…)
 * @returns jeton et identifiant public
 */
export function generateToken(type: string): GeneratedToken {
  const publicId = randomString(BASE58, TOKEN_PUBLIC_ID_LENGTH);
  const body = `pvb_${type}_${publicId}_${randomString(BASE62, TOKEN_SECRET_LENGTH)}`;
  return { value: `${body}_${checksum(body)}`, publicId };
}

/**
 * Analyse un jeton : forme, type attendu et somme de contrôle, sans accès à la base (§8.8, étape 1).
 * @param token jeton brut
 * @param type type attendu
 * @returns identifiant public, ou `undefined` si le jeton est mal formé
 */
export function parseToken(token: string, type: string): string | undefined {
  const pattern = new RegExp(`^pvb_${type}_([1-9A-HJ-NP-Za-km-z]{8})_[0-9A-Za-z]{43}_([0-9A-Za-z]{6})$`, 'u');
  const match = pattern.exec(token);
  if (match === null) {
    return undefined;
  }
  const body = token.slice(0, token.length - TOKEN_CHECKSUM_LENGTH - 1);
  return checksum(body) === match[2] ? match[1] : undefined;
}

/**
 * Empreinte HMAC-SHA-256 d'un secret avec le poivre serveur.
 * @param pepper poivre de l'instance
 * @param secret valeur secrète
 * @returns empreinte binaire
 */
export function hmacSecret(pepper: string, secret: string): Buffer {
  return createHmac('sha256', pepper).update(secret).digest();
}

/**
 * Compare deux empreintes en temps constant.
 * @param left première empreinte
 * @param right seconde empreinte
 * @returns vrai si elles sont égales
 */
export function sameDigest(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Empreinte SHA-256 hexadécimale.
 * @param input donnée
 * @returns empreinte
 */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Génère un UUIDv7 (horodatage 48 bits + aléa), conforme à la RFC 9562.
 * @param now instant courant en millisecondes
 * @returns UUID canonique
 */
export function uuidv7(now: number): string {
  const bytes = randomBytes(UUID_BYTES);
  let timestamp = now;
  for (let index = TIMESTAMP_BYTES - 1; index >= 0; index -= 1) {
    bytes[index] = timestamp % BYTE_RANGE;
    timestamp = Math.floor(timestamp / BYTE_RANGE);
  }
  bytes[TIMESTAMP_BYTES] = VERSION_7 | ((bytes[TIMESTAMP_BYTES] ?? 0) & LOW_NIBBLE);
  bytes[BITS_PER_BYTE] = VARIANT_RFC | ((bytes[BITS_PER_BYTE] ?? 0) & LOW_SIX_BITS);
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Hache un mot de passe avec argon2id (paramètres minimaux du §8.1).
 * @param password mot de passe en clair
 * @returns empreinte encodée PHC
 */
export async function hashPassword(password: string): Promise<string> {
  // Valeur numérique de l'énumération constante `Algorithm.Argon2id`, inaccessible en modules isolés.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-assignment -- valeur 2 = Argon2id, vérifiée par les tests d'intégration
  return hash(password, { algorithm: ARGON2_ID, memoryCost: ARGON2_MEMORY_KIB, timeCost: ARGON2_ITERATIONS, parallelism: 1 });
}

/**
 * Vérifie un mot de passe contre son empreinte argon2id.
 * @param encoded empreinte PHC
 * @param password mot de passe en clair
 * @returns vrai si le mot de passe correspond
 */
export async function verifyPassword(encoded: string, password: string): Promise<boolean> {
  try {
    return await verify(encoded, password);
  } catch {
    return false;
  }
}

const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;
const AES_KEY_BYTES = 32;

/**
 * Dérive une clé AES-256 depuis un secret d'instance (fichier généré à l'installation).
 * @param material secret d'instance
 * @returns clé de 32 octets
 */
export function deriveKey(material: string): Buffer {
  return createHash('sha256').update(material).digest().subarray(0, AES_KEY_BYTES);
}

/**
 * Chiffre un champ en AES-256-GCM ; les données associées empêchent la substitution (§9.3).
 * @param key clé AES-256
 * @param plaintext valeur en clair
 * @param associatedData données associées (table, colonne, ligne)
 * @returns chiffré encodé en base64 (iv | tag | données)
 */
export function encryptField(key: Buffer, plaintext: string, associatedData: string): string {
  const iv = randomBytes(GCM_IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: GCM_TAG_BYTES });
  cipher.setAAD(Buffer.from(associatedData));
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

/**
 * Déchiffre un champ AES-256-GCM ; l'étiquette doit faire exactement 16 octets (une étiquette tronquée
 * affaiblirait l'authentification).
 * @param key clé AES-256
 * @param encoded chiffré base64
 * @param associatedData données associées
 * @returns valeur en clair
 * @throws Error si le chiffré est trop court, altéré ou lié à d'autres données associées
 */
export function decryptField(key: Buffer, encoded: string, associatedData: string): string {
  const raw = Buffer.from(encoded, 'base64');
  if (raw.length < GCM_IV_BYTES + GCM_TAG_BYTES) {
    throw new Error('Champ chiffré invalide : longueur insuffisante');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, GCM_IV_BYTES), { authTagLength: GCM_TAG_BYTES });
  decipher.setAAD(Buffer.from(associatedData));
  decipher.setAuthTag(raw.subarray(GCM_IV_BYTES, GCM_IV_BYTES + GCM_TAG_BYTES));
  return Buffer.concat([decipher.update(raw.subarray(GCM_IV_BYTES + GCM_TAG_BYTES)), decipher.final()]).toString('utf8');
}

/**
 * Secret aléatoire en base62 (sessions, codes d'invitation, CSRF).
 * @param length longueur
 * @returns secret
 */
export function randomSecret(length: number): string {
  return randomString(BASE62, length);
}
