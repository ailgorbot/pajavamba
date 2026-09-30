/**
 * Cas d'usage des utilisateurs : profil, invitation, acceptation, désactivation, réactivation.
 *
 * Couche : basse (identity/fonctionnel). Règles : RG-IAM-005 (révocation immédiate à la
 * désactivation), RG-ORG-001 (un propriétaire actif), RI-CNX-10, §8.2 (invitation 72 heures).
 */
import { domainError, err, ok, requireAccess, toEntityId, type DomainError, type ExecutionContext, type Result, type UseCaseOutput, type UserId } from '@pajavamba/kernel';
import type { OrganisationRole, Theme, User } from '../domaine/identity-model.ts';
import { IDENTITY_EVENTS, identityEvent } from '../domaine/identity.events.ts';
import { checkPassword, validateEmail, validateName } from '../domaine/identity.rules.ts';
import { findSystemRole } from '../domaine/roles.catalog.ts';
import type { IdentityDependencies } from '../ports/identity.ports.ts';

const INVITATION_TTL_MS = 259_200_000;
const USER_NOT_FOUND = domainError('identity.user_not_found', 'not_found', 'Utilisateur introuvable.');
const EMAIL_TAKEN = domainError('identity.email_taken', 'conflict', 'Un utilisateur existe déjà avec cette adresse.');
const INVALID_INVITATION = domainError('identity.invalid_invitation', 'not_found', "Ce lien d'invitation est invalide ou expiré.");
const LAST_OWNER = domainError('identity.last_owner', 'conflict', "L'organisation doit conserver au moins un propriétaire actif.");
const SELF_DEACTIVATION = domainError('identity.self_deactivation', 'conflict', 'Vous ne pouvez pas désactiver votre propre compte.');

/** Modification du profil. */
export interface UpdateProfileInput {
  readonly displayName?: string;
  readonly theme?: Theme;
}

/**
 * Modifie le profil de l'utilisateur courant (`me.update`).
 * @param dependencies dépendances
 * @param userId utilisateur courant
 * @param input champs modifiés
 * @returns utilisateur modifié
 */
export async function updateProfile(dependencies: IdentityDependencies, userId: UserId, input: UpdateProfileInput): Promise<Result<UseCaseOutput<User>, DomainError>> {
  const user = await dependencies.users.findById(userId);
  if (user === undefined) return err(USER_NOT_FOUND);
  const name = input.displayName === undefined ? ok(user.displayName) : validateName(input.displayName);
  if (!name.ok) return name;
  const updated: User = { ...user, displayName: name.value, theme: input.theme ?? user.theme, version: user.version + 1 };
  await dependencies.users.update(updated);
  return ok({ result: updated, events: [identityEvent(IDENTITY_EVENTS.userUpdated, user.id, { fields: Object.keys(input) }, updated.version)] });
}

/** Entrée d'une invitation. */
export interface InviteUserInput {
  readonly email: string;
  readonly displayName: string;
  readonly orgRole: Exclude<OrganisationRole, 'owner'>;
}

/**
 * Invite un utilisateur dans l'organisation (`user.invite`, R3) ; le code n'est remis qu'une fois.
 * @param dependencies dépendances
 * @param context contexte d'exécution
 * @param input adresse, nom et rôle d'organisation
 * @returns code d'invitation et identifiant
 */
export async function inviteUser(dependencies: IdentityDependencies, context: ExecutionContext, input: InviteUserInput): Promise<Result<UseCaseOutput<{ readonly userId: UserId; readonly invitationCode: string }>, DomainError>> {
  const access = await requireAccess(dependencies.policy, context, { permission: 'user:manage', risk: 'R3' });
  if (!access.ok) return access;
  const email = validateEmail(input.email);
  if (!email.ok) return email;
  const name = validateName(input.displayName);
  if (!name.ok) return name;
  if ((await dependencies.users.findByEmail(email.value)) !== undefined) return err(EMAIL_TAKEN);
  const user: User = { id: toEntityId(dependencies.ids.next()), email: email.value, displayName: name.value, status: 'invited', theme: 'system', passwordHash: null, failedLoginCount: 0, lastFailedLoginAt: null, version: 1 };
  const code = dependencies.secrets.issueInvitationCode();
  const assignmentId = dependencies.ids.next();
  await dependencies.users.insert(user);
  await dependencies.organisations.upsertMembership({ organisationId: context.organisationId, userId: user.id, orgRole: input.orgRole, status: 'invited' });
  await dependencies.assignments.insert({ id: assignmentId, organisationId: context.organisationId, userId: user.id, roleKey: input.orgRole, scope: { type: 'organisation' }, effect: 'allow', grantedBy: context.actor.kind === 'user' ? context.actor.userId : null });
  await dependencies.credentials.insertInvitation({ userId: user.id, organisationId: context.organisationId, codeHash: code.hash, expiresAt: dependencies.clock.now() + INVITATION_TTL_MS });
  const permissions = findSystemRole(input.orgRole)?.permissions ?? [];
  return ok({ result: { userId: user.id, invitationCode: code.value }, events: [identityEvent(IDENTITY_EVENTS.userProvisioned, user.id, { organisationId: context.organisationId, source: 'invitation' }), identityEvent(IDENTITY_EVENTS.roleAssigned, assignmentId, { userId: user.id, roleKey: input.orgRole, scopeType: 'organisation', scopeId: context.organisationId, effect: 'allow', permissions: [...permissions] })] });
}

/**
 * Accepte une invitation en définissant son mot de passe (`invitation.accept`, public).
 * @param dependencies dépendances
 * @param code code d'invitation
 * @param password mot de passe choisi
 * @returns utilisateur activé
 */
export async function acceptInvitation(dependencies: IdentityDependencies, code: string, password: string): Promise<Result<UseCaseOutput<{ readonly userId: UserId }>, DomainError>> {
  const checked = checkPassword(password, dependencies.secrets.isCompromised(password));
  if (!checked.ok) return checked;
  const invitation = await dependencies.credentials.consumeInvitation(dependencies.secrets.hashSecret(code), dependencies.clock.now());
  const user = invitation === undefined ? undefined : await dependencies.users.findById(invitation.userId);
  if (invitation === undefined || user?.status !== 'invited') return err(INVALID_INVITATION);
  await dependencies.users.update({ ...user, status: 'active', passwordHash: await dependencies.secrets.hashPassword(password), version: user.version + 1 });
  const membership = await dependencies.organisations.findMembership(invitation.organisationId, user.id);
  if (membership !== undefined) await dependencies.organisations.upsertMembership({ ...membership, status: 'active' });
  return ok({ result: { userId: user.id }, events: [identityEvent(IDENTITY_EVENTS.userReactivated, user.id, { organisationId: invitation.organisationId, source: 'invitation' })] });
}

/**
 * Désactive un utilisateur et révoque immédiatement sessions et clés (`user.deactivate`, R3).
 * @param dependencies dépendances
 * @param context contexte d'exécution
 * @param userId utilisateur visé
 * @returns événements
 */
export async function deactivateUser(dependencies: IdentityDependencies, context: ExecutionContext, userId: UserId): Promise<Result<UseCaseOutput<null>, DomainError>> {
  const access = await requireAccess(dependencies.policy, context, { permission: 'user:manage', risk: 'R3' });
  if (!access.ok) return access;
  if (context.actor.kind === 'user' && context.actor.userId === userId) return err(SELF_DEACTIVATION);
  const [user, membership] = await Promise.all([dependencies.users.findById(userId), dependencies.organisations.findMembership(context.organisationId, userId)]);
  if (user === undefined || membership === undefined) return err(USER_NOT_FOUND);
  if (membership.orgRole === 'owner' && (await dependencies.assignments.countOwners(context.organisationId)) <= 1) return err(LAST_OWNER);
  const now = dependencies.clock.now();
  await dependencies.users.update({ ...user, status: 'deactivated', version: user.version + 1 });
  await dependencies.sessions.revokeAllOf(userId, now);
  await dependencies.credentials.revokeKeysOf(userId, now);
  return ok({ result: null, events: [identityEvent(IDENTITY_EVENTS.userDeactivated, userId, { organisationId: context.organisationId }, user.version + 1)] });
}

/**
 * Réactive un utilisateur désactivé (`user.reactivate`, R3).
 * @param dependencies dépendances
 * @param context contexte d'exécution
 * @param userId utilisateur visé
 * @returns événements
 */
export async function reactivateUser(dependencies: IdentityDependencies, context: ExecutionContext, userId: UserId): Promise<Result<UseCaseOutput<null>, DomainError>> {
  const access = await requireAccess(dependencies.policy, context, { permission: 'user:manage', risk: 'R3' });
  if (!access.ok) return access;
  const user = await dependencies.users.findById(userId);
  const membership = await dependencies.organisations.findMembership(context.organisationId, userId);
  if (user?.status !== 'deactivated' || membership === undefined) return err(USER_NOT_FOUND);
  await dependencies.users.update({ ...user, status: 'active', version: user.version + 1 });
  return ok({ result: null, events: [identityEvent(IDENTITY_EVENTS.userReactivated, userId, { organisationId: context.organisationId, source: 'admin' }, user.version + 1)] });
}
