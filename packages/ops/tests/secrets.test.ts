/**
 * Tests du chiffrement des champs AES-256-GCM.
 *
 * Couche : haute (OPS). Règles vérifiées : RI-SEC-05, RI-SCR-03 ; constat Semgrep `gcm-no-tag-length` (#265).
 */
import { describe, expect, it } from 'vitest';
import { decryptField, deriveKey, encryptField } from '../src/secrets.ts';

const KEY = deriveKey('secret-de-test-non-utilise-en-production');
const AAD = 'identity.totp_factors.secret:utilisateur-1';

describe('chiffrement des champs', () => {
  it('restitue la valeur chiffrée', () => {
    expect(decryptField(KEY, encryptField(KEY, 'valeur secrète', AAD), AAD)).toBe('valeur secrète');
  });

  it('refuse une étiquette tronquée', () => {
    const raw = Buffer.from(encryptField(KEY, 'valeur secrète', AAD), 'base64');
    const truncated = Buffer.concat([raw.subarray(0, 12), raw.subarray(12, 16)]).toString('base64');
    expect(() => decryptField(KEY, truncated, AAD)).toThrow();
  });

  it('refuse un chiffré altéré', () => {
    const raw = Buffer.from(encryptField(KEY, 'valeur secrète', AAD), 'base64');
    raw[raw.length - 1] = (raw[raw.length - 1] ?? 0) ^ 0xff;
    expect(() => decryptField(KEY, raw.toString('base64'), AAD)).toThrow();
  });

  it('refuse des données associées différentes', () => {
    expect(() => decryptField(KEY, encryptField(KEY, 'valeur secrète', AAD), 'identity.totp_factors.secret:utilisateur-2')).toThrow();
  });
});
