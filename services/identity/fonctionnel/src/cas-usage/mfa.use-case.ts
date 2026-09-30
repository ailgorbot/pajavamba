/**
 * Cas d'usage MFA : enrôlement TOTP avec codes de récupération.
 *
 * Couche : basse (identity/fonctionnel). Règles : RI-CNX-03 (MFA TOTP disponible), §8.1
 * (10 codes de récupération à usage unique, stockés sous forme d'empreintes argon2id).
 */
import { domainError, err, ok, type DomainError, type Result, type UseCaseOutput, type UserId } from '@pajavamba/kernel';
import { IDENTITY_EVENTS, identityEvent } from '../domaine/identity.events.ts';
import type { IdentityDependencies } from '../ports/identity.ports.ts';

/** Enrôlement démarré : URI `otpauth://` et secret à saisir manuellement. */
export interface TotpEnrollment {
  readonly otpauthUri: string;
  readonly secret: string;
}

const ALREADY_ENROLLED = domainError('identity.mfa_already_enrolled', 'conflict', 'Une application d’authentification est déjà enrôlée.');
const NO_PENDING_ENROLLMENT = domainError('identity.mfa_not_started', 'conflict', "Démarrez d'abord l'enrôlement.");
const INVALID_CODE = domainError('identity.invalid_mfa_code', 'validation', 'Le code saisi est incorrect ou expiré.');
const UNKNOWN_USER = domainError('identity.user_not_found', 'not_found', 'Utilisateur introuvable.');

/**
 * Démarre l'enrôlement TOTP de l'utilisateur courant.
 * @param dependencies dépendances
 * @param userId utilisateur courant
 * @returns URI et secret à afficher une fois
 */
export async function startTotpEnrollment(dependencies: IdentityDependencies, userId: UserId): Promise<Result<UseCaseOutput<TotpEnrollment>, DomainError>> {
  const [user, existing] = await Promise.all([dependencies.users.findById(userId), dependencies.mfa.findTotp(userId)]);
  if (user === undefined) return err(UNKNOWN_USER);
  if (existing?.confirmed === true) return err(ALREADY_ENROLLED);
  const secret = dependencies.secrets.generateTotpSecret();
  await dependencies.mfa.saveTotp({ userId, secret, confirmed: false });
  return ok({ result: { otpauthUri: dependencies.secrets.totpUri(secret, user.email), secret }, events: [] });
}

/**
 * Confirme l'enrôlement TOTP par un premier code et émet les codes de récupération.
 * @param dependencies dépendances
 * @param userId utilisateur courant
 * @param code code saisi
 * @returns codes de récupération, affichés une seule fois
 */
export async function confirmTotpEnrollment(dependencies: IdentityDependencies, userId: UserId, code: string): Promise<Result<UseCaseOutput<{ readonly recoveryCodes: readonly string[] }>, DomainError>> {
  const factor = await dependencies.mfa.findTotp(userId);
  if (factor === undefined) return err(NO_PENDING_ENROLLMENT);
  if (factor.confirmed) return err(ALREADY_ENROLLED);
  if (!dependencies.secrets.verifyTotp(factor.secret, code, dependencies.clock.now())) return err(INVALID_CODE);
  await dependencies.mfa.saveTotp({ ...factor, confirmed: true });
  const recovery = await dependencies.secrets.issueRecoveryCodes();
  await dependencies.mfa.replaceRecoveryCodes(userId, recovery.hashes);
  return ok({ result: { recoveryCodes: recovery.codes }, events: [identityEvent(IDENTITY_EVENTS.mfaEnrolled, userId, { factor: 'totp' })] });
}
