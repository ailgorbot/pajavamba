/**
 * Adaptateur du port `SecretService` : aléa sûr, empreintes HMAC avec poivre, argon2id, TOTP.
 *
 * Couche : moyenne (identity/structure). Règles : RI-SEC-05 (bibliothèques éprouvées, aucune
 * cryptographie maison), RI-SCR-03, RI-SCR-09, RI-CNX-02, RI-CNX-03.
 */
import type { IssuedSecret, SecretService } from '@pajavamba/identity-fonctionnel';
import { generateToken, hashPassword, hmacSecret, randomSecret, sameDigest, verifyPassword } from '@pajavamba/ops';
import { Secret, TOTP } from 'otpauth';
import { isCompromisedPassword } from './compromised-passwords.ts';

const SESSION_SECRET_LENGTH = 43;
const CSRF_LENGTH = 32;
const INVITATION_LENGTH = 32;
const RECOVERY_CODE_LENGTH = 10;
const RECOVERY_CODE_COUNT = 10;
const TOTP_SECRET_BYTES = 20;
const TOTP_WINDOW = 1;
const ISSUER = 'PajaVamba';

/** Secrets d'instance nécessaires à l'adaptateur. */
export interface InstanceSecrets {
  /** Poivre des empreintes de jetons. */
  readonly pepper: string;
  /** Code d'initialisation généré à l'installation. */
  readonly setupCode: string;
  /** Empreinte argon2id factice, pour un temps de réponse comparable sur compte inconnu. */
  readonly dummyPasswordHash: string;
}

/**
 * Construit un objet TOTP (SHA-1, 6 chiffres, 30 secondes : paramètres des applications usuelles).
 * @param secret secret base32
 * @param label libellé du compte
 * @returns objet TOTP
 */
function totpOf(secret: string, label: string): TOTP {
  return new TOTP({ issuer: ISSUER, label, algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secret) });
}

/**
 * Crée l'adaptateur `SecretService`.
 * @param secrets secrets d'instance
 * @returns adaptateur
 */
export function createSecretService(secrets: InstanceSecrets): SecretService {
  const issue = (length: number): IssuedSecret => {
    const value = randomSecret(length);
    return { value, hash: hmacSecret(secrets.pepper, value) };
  };
  return {
    hashPassword,
    verifyPassword: async (hash, password) => verifyPassword(hash === '' ? secrets.dummyPasswordHash : hash, password),
    isCompromised: isCompromisedPassword,
    issueSessionSecret: () => issue(SESSION_SECRET_LENGTH),
    issueCsrfToken: () => randomSecret(CSRF_LENGTH),
    issueInvitationCode: () => issue(INVITATION_LENGTH),
    issueApiKey: () => {
      const token = generateToken('key');
      return { value: token.value, publicId: token.publicId, hash: hmacSecret(secrets.pepper, token.value) };
    },
    hashSecret: (value) => hmacSecret(secrets.pepper, value),
    sameHash: (left, right) => sameDigest(Buffer.from(left), Buffer.from(right)),
    async issueRecoveryCodes() {
      const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => randomSecret(RECOVERY_CODE_LENGTH));
      return { codes, hashes: await Promise.all(codes.map(hashPassword)) };
    },
    generateTotpSecret: () => new Secret({ size: TOTP_SECRET_BYTES }).base32,
    totpUri: (secret, label) => totpOf(secret, label).toString(),
    verifyTotp: (secret, code, now) => totpOf(secret, 'verification').validate({ token: code.replaceAll(' ', ''), timestamp: now, window: TOTP_WINDOW }) !== null,
    verifySetupCode: (code) => code.length > 0 && sameDigest(hmacSecret(secrets.pepper, code), hmacSecret(secrets.pepper, secrets.setupCode)),
  };
}

