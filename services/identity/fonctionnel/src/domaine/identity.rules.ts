/**
 * Règles de gestion des identités : slug, noms, adresses, mots de passe, sessions, ralentissement.
 *
 * Couche : basse (identity/fonctionnel). Règles : RG-ORG-002, RI-CNX-02 (12 caractères minimum,
 * contrôle contre les mots de passe compromis), RI-CNX-09 (ralentissement progressif sans
 * verrouillage définitif), §8.3 (12 heures absolues, 30 minutes d'inactivité).
 */
import { domainError, err, ok, type DomainError, type Result } from '@pajavamba/kernel';
import type { Session, User } from './identity-model.ts';

const SLUG_PATTERN = /^[a-z0-9-]{3,40}$/u;
const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/u;
const NAME_MAX_LENGTH = 120;
/** Longueur minimale d'un mot de passe (RI-CNX-02). */
export const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 256;
/** Durée absolue d'une session : 12 heures. */
export const SESSION_ABSOLUTE_TTL_MS = 43_200_000;
/** Durée d'inactivité d'une session : 30 minutes. */
export const SESSION_IDLE_TTL_MS = 1_800_000;
const THROTTLE_FREE_ATTEMPTS = 3;
const THROTTLE_BASE_MS = 1_000;
const THROTTLE_MAX_MS = 30_000;

/**
 * Valide le slug d'une organisation (RG-ORG-002).
 * @param slug slug proposé
 * @returns le slug ou une erreur
 */
export function validateSlug(slug: string): Result<string, DomainError> {
  return SLUG_PATTERN.test(slug) ? ok(slug) : err(domainError('identity.invalid_slug', 'validation', "L'identifiant d'organisation doit contenir 3 à 40 caractères parmi a-z, 0-9 et « - »."));
}

/**
 * Valide un nom affiché (1 à 120 caractères, espaces de bord retirés).
 * @param name nom proposé
 * @returns le nom normalisé ou une erreur
 */
export function validateName(name: string): Result<string, DomainError> {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= NAME_MAX_LENGTH ? ok(trimmed) : err(domainError('identity.invalid_name', 'validation', 'Le nom doit contenir entre 1 et 120 caractères.'));
}

/**
 * Normalise et valide une adresse électronique.
 * @param email adresse proposée
 * @returns l'adresse en minuscules ou une erreur
 */
export function validateEmail(email: string): Result<string, DomainError> {
  const normalized = email.trim().toLowerCase();
  return EMAIL_PATTERN.test(normalized) ? ok(normalized) : err(domainError('identity.invalid_email', 'validation', "L'adresse électronique est invalide."));
}

/**
 * Contrôle un mot de passe : longueur et liste de mots de passe compromis (RI-CNX-02).
 * @param password mot de passe proposé
 * @param isCompromised vrai si le mot de passe figure dans la liste embarquée
 * @returns succès ou erreur
 */
export function checkPassword(password: string, isCompromised: boolean): Result<string, DomainError> {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return err(domainError('identity.password_too_short', 'validation', 'Le mot de passe doit contenir au moins 12 caractères.'));
  }
  if (isCompromised) {
    return err(domainError('identity.password_compromised', 'validation', 'Ce mot de passe figure dans une liste de mots de passe compromis. Choisissez-en un autre.'));
  }
  return ok(password);
}

/**
 * Indique si une session est encore valide (non révoquée, ni expirée, ni inactive).
 * @param session session
 * @param now instant courant
 * @returns vrai si la session est active
 */
export function isSessionActive(session: Session, now: number): boolean {
  return session.revokedAt === null && now - session.createdAt <= SESSION_ABSOLUTE_TTL_MS && now - session.lastSeenAt <= SESSION_IDLE_TTL_MS;
}

/**
 * Délai de ralentissement avant une nouvelle tentative de connexion (aucun verrouillage définitif).
 * @param user utilisateur visé
 * @param now instant courant
 * @returns millisecondes restant à attendre (0 si la tentative est permise)
 */
export function loginDelayRemaining(user: User, now: number): number {
  const excess = user.failedLoginCount - THROTTLE_FREE_ATTEMPTS;
  if (excess < 0 || user.lastFailedLoginAt === null) {
    return 0;
  }
  const delay = Math.min(THROTTLE_BASE_MS * 2 ** excess, THROTTLE_MAX_MS);
  return Math.max(0, user.lastFailedLoginAt + delay - now);
}

/** Erreur uniforme d'échec de connexion, quel que soit le motif (RI-CNX-09). */
export const INVALID_CREDENTIALS = domainError('identity.invalid_credentials', 'forbidden', 'Identifiants incorrects.');
