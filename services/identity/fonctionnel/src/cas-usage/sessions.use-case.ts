/**
 * Cas d'usage de session : connexion, authentification, liste, révocation, déconnexion, MFA récente.
 *
 * Couche : basse (identity/fonctionnel). Règles : RI-CNX-09 (message uniforme, ralentissement
 * progressif), RI-CNX-03 (MFA), RG-IAM-005, §8.3.
 */
import { domainError, err, ok, type DomainError, type ExecutionContext, type Result, type UseCaseOutput, type UserId } from '@pajavamba/kernel';
import type { Session, User } from '../domaine/identity-model.ts';
import { IDENTITY_EVENTS, identityEvent } from '../domaine/identity.events.ts';
import { INVALID_CREDENTIALS, isSessionActive, loginDelayRemaining } from '../domaine/identity.rules.ts';
import type { IdentityDependencies } from '../ports/identity.ports.ts';

/** Entrée de la connexion. */
export interface OpenSessionInput {
  readonly email: string;
  readonly password: string;
  readonly totpCode: string | null;
}

/** Session ouverte : secret à poser en cookie et jeton CSRF. */
export interface OpenedSession {
  readonly status: 'opened';
  readonly sessionSecret: string;
  readonly csrfToken: string;
  readonly userId: UserId;
}

/**
 * Tentative rejetée : le compteur de ralentissement est validé en base, la couche moyenne
 * renvoie ensuite l'erreur uniforme (RI-CNX-09).
 */
export interface RejectedLogin {
  readonly status: 'rejected';
  readonly userId: UserId;
}

const MFA_REQUIRED = domainError('identity.mfa_required', 'validation', "Saisissez le code à usage unique de votre application d'authentification.");
const THROTTLED = domainError('identity.login_throttled', 'conflict', 'Trop de tentatives. Patientez quelques secondes avant de réessayer.');
const SESSION_NOT_FOUND = domainError('identity.session_not_found', 'not_found', 'Session introuvable.');
const INVALID_MFA_CODE = domainError('identity.invalid_mfa_code', 'validation', 'Le code saisi est incorrect ou expiré.');

/**
 * Enregistre un échec de connexion (compteur de ralentissement).
 * @param dependencies dépendances
 * @param user utilisateur visé
 * @returns erreur uniforme
 */
async function recordFailure(dependencies: IdentityDependencies, user: User): Promise<Result<UseCaseOutput<RejectedLogin>, DomainError>> {
  await dependencies.users.update({ ...user, failedLoginCount: user.failedLoginCount + 1, lastFailedLoginAt: dependencies.clock.now(), version: user.version + 1 });
  return ok({ result: { status: 'rejected', userId: user.id }, events: [identityEvent(IDENTITY_EVENTS.loginFailed, user.id, { attempts: user.failedLoginCount + 1 })] });
}

/**
 * Vérifie le second facteur si l'utilisateur en a enrôlé un.
 * @param dependencies dépendances
 * @param user utilisateur
 * @param code code saisi
 * @returns instant de vérification (ou `null` sans MFA), ou erreur
 */
async function checkSecondFactor(dependencies: IdentityDependencies, user: User, code: string | null): Promise<Result<number | null, DomainError>> {
  const factor = await dependencies.mfa.findTotp(user.id);
  if (factor === undefined || !factor.confirmed) return ok(null);
  if (code === null || code === '') return err(MFA_REQUIRED);
  const now = dependencies.clock.now();
  return dependencies.secrets.verifyTotp(factor.secret, code, now) ? ok(now) : err(INVALID_CREDENTIALS);
}

/**
 * Crée la session d'un utilisateur authentifié dans sa première organisation active.
 * @param dependencies dépendances
 * @param user utilisateur
 * @param mfaVerifiedAt instant de vérification MFA
 * @returns session ouverte
 */
async function createSession(dependencies: IdentityDependencies, user: User, mfaVerifiedAt: number | null): Promise<Result<UseCaseOutput<OpenedSession | RejectedLogin>, DomainError>> {
  const membership = await dependencies.organisations.firstActiveMembership(user.id);
  if (membership === undefined) return err(INVALID_CREDENTIALS);
  const now = dependencies.clock.now();
  const secret = dependencies.secrets.issueSessionSecret();
  const session: Session = { id: dependencies.ids.next(), userId: user.id, organisationId: membership.organisationId, createdAt: now, lastSeenAt: now, mfaVerifiedAt, csrfToken: dependencies.secrets.issueCsrfToken(), revokedAt: null };
  await dependencies.sessions.insert(session, secret.hash);
  await dependencies.users.update({ ...user, failedLoginCount: 0, lastFailedLoginAt: null, version: user.version + 1 });
  return ok({ result: { status: 'opened', sessionSecret: secret.value, csrfToken: session.csrfToken, userId: user.id }, events: [identityEvent(IDENTITY_EVENTS.sessionOpened, session.id, { userId: user.id, organisationId: membership.organisationId, mfa: mfaVerifiedAt !== null })] });
}

/**
 * Ouvre une session à partir d'un compte local (`session.open`).
 * @param dependencies dépendances
 * @param input identifiants
 * @returns session ouverte ou erreur uniforme
 */
export async function openSession(dependencies: IdentityDependencies, input: OpenSessionInput): Promise<Result<UseCaseOutput<OpenedSession | RejectedLogin>, DomainError>> {
  const user = await dependencies.users.findByEmail(input.email.trim().toLowerCase());
  if (user === undefined || user.passwordHash === null || user.status !== 'active') {
    await dependencies.secrets.verifyPassword('', input.password);
    return err(INVALID_CREDENTIALS);
  }
  if (loginDelayRemaining(user, dependencies.clock.now()) > 0) return err(THROTTLED);
  if (!(await dependencies.secrets.verifyPassword(user.passwordHash, input.password))) return recordFailure(dependencies, user);
  const secondFactor = await checkSecondFactor(dependencies, user, input.totpCode);
  if (!secondFactor.ok) return secondFactor.error === MFA_REQUIRED ? secondFactor : recordFailure(dependencies, user);
  return createSession(dependencies, user, secondFactor.value);
}

/** Session authentifiée. */
export interface AuthenticatedSession {
  readonly session: Session;
  readonly user: User;
}

/**
 * Authentifie un secret de session : session active, utilisateur actif ; met à jour l'activité.
 * @param dependencies dépendances
 * @param secret secret brut du cookie
 * @returns session authentifiée ou `undefined`
 */
export async function authenticateSession(dependencies: IdentityDependencies, secret: string): Promise<AuthenticatedSession | undefined> {
  const session = await dependencies.sessions.findBySecretHash(dependencies.secrets.hashSecret(secret));
  const now = dependencies.clock.now();
  if (session === undefined || !isSessionActive(session, now)) return undefined;
  const user = await dependencies.users.findById(session.userId);
  if (user?.status !== 'active') return undefined;
  await dependencies.sessions.update({ ...session, lastSeenAt: now });
  return { session, user };
}

/**
 * Liste les sessions actives de l'utilisateur courant (`session.list`).
 * @param dependencies dépendances
 * @param userId utilisateur courant
 * @returns sessions actives
 */
export async function listMySessions(dependencies: IdentityDependencies, userId: UserId): Promise<readonly Session[]> {
  return dependencies.sessions.listActiveOf(userId, dependencies.clock.now());
}

/**
 * Révoque une session de l'utilisateur courant (`session.revoke`, déconnexion comprise).
 * @param dependencies dépendances
 * @param context contexte d'exécution
 * @param sessionId session à révoquer
 * @returns événements
 */
export async function revokeMySession(dependencies: IdentityDependencies, context: ExecutionContext, sessionId: string): Promise<Result<UseCaseOutput<null>, DomainError>> {
  const session = await dependencies.sessions.findById(sessionId);
  if (context.actor.kind !== 'user' || session?.userId !== context.actor.userId) return err(SESSION_NOT_FOUND);
  await dependencies.sessions.update({ ...session, revokedAt: dependencies.clock.now() });
  return ok({ result: null, events: [identityEvent(IDENTITY_EVENTS.sessionRevoked, session.id, { userId: session.userId, reason: 'user' })] });
}

/**
 * Vérifie un code TOTP pour une session existante (MFA récente exigée par les actions R3).
 * @param dependencies dépendances
 * @param sessionId session courante
 * @param code code saisi
 * @returns succès ou erreur
 */
export async function verifyRecentMfa(dependencies: IdentityDependencies, sessionId: string, code: string): Promise<Result<UseCaseOutput<null>, DomainError>> {
  const session = await dependencies.sessions.findById(sessionId);
  if (session === undefined) return err(SESSION_NOT_FOUND);
  const factor = await dependencies.mfa.findTotp(session.userId);
  const now = dependencies.clock.now();
  if (factor?.confirmed !== true || !dependencies.secrets.verifyTotp(factor.secret, code, now)) return err(INVALID_MFA_CODE);
  await dependencies.sessions.update({ ...session, mfaVerifiedAt: now });
  return ok({ result: null, events: [] });
}
