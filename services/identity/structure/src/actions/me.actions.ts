/**
 * Actions du profil : moi, modification, enrôlement TOTP, clé API personnelle.
 *
 * Couche : moyenne (identity/structure). Règles : RI-SCR-03 (jeton affiché une seule fois, jamais
 * stocké pour rejeu), RI-CNX-03, §8.4.
 */
import { defineAction, type ActionCall, type RegisteredAction } from '@pajavamba/contracts';
import { confirmTotpEnrollment, createApiKey, findSystemRole, revokeApiKey, startTotpEnrollment, updateProfile, type ApiKey, type IdentityDependencies } from '@pajavamba/identity-fonctionnel';
import { domainError, err, ok, type ExecutionContext, type UserId } from '@pajavamba/kernel';
import { parseInput, requireContext, UNAUTHENTICATED } from '@pajavamba/ops';
import { z } from 'zod';
import { identityRead, identityWrite, type IdentityRuntime } from '../composition/identity-runtime.ts';

const ProfileInput = z.strictObject({
  displayName: z.string().max(120).optional().describe('Nom affiché'),
  theme: z.enum(['system', 'light', 'dark']).optional().describe("Thème d'affichage"),
});
const CodeInput = z.strictObject({ code: z.string().min(6).max(10).describe('Code à usage unique') });
const ApiKeyInput = z.strictObject({ name: z.string().max(80).describe('Nom de la clé'), readOnly: z.boolean().describe('Lecture seule') });

/**
 * Identifiant de l'utilisateur authentifié.
 * @param context contexte
 * @returns utilisateur
 */
function userOf(context: ExecutionContext): UserId {
  if (context.actor.kind !== 'user') throw UNAUTHENTICATED;
  return context.actor.userId;
}

/**
 * Permissions effectives au niveau de l'organisation (refus explicites déduits).
 * @param dependencies dépendances
 * @param context contexte
 * @returns permissions triées
 */
async function organisationPermissions(dependencies: IdentityDependencies, context: ExecutionContext): Promise<string[]> {
  const assignments = await dependencies.assignments.listForUser(context.organisationId, userOf(context));
  const organisationLevel = assignments.filter((assignment) => assignment.scope.type === 'organisation');
  const permissionsOf = (effect: 'allow' | 'deny'): string[] => organisationLevel.filter((assignment) => assignment.effect === effect).flatMap((assignment) => findSystemRole(assignment.roleKey)?.permissions ?? []);
  const denied = new Set(permissionsOf('deny'));
  return [...new Set(permissionsOf('allow'))].filter((permission) => !denied.has(permission)).sort((left, right) => left.localeCompare(right));
}

/**
 * Date ISO 8601 ou `null`.
 * @param value instant en millisecondes
 * @returns date ISO ou `null`
 */
function isoOrNull(value: number | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

/**
 * Métadonnées publiques de la clé API (jamais le secret).
 * @param key clé active éventuelle
 * @returns représentation API ou `null`
 */
function apiKeyBody(key: ApiKey | undefined): Record<string, unknown> | null {
  return key === undefined ? null : { publicId: key.publicId, name: key.name, readOnly: key.readOnly, createdAt: new Date(key.createdAt).toISOString(), lastUsedAt: isoOrNull(key.lastUsedAt) };
}

/**
 * Lit le profil courant, son organisation et ses permissions d'organisation.
 * @param runtime environnement
 * @param call appel
 * @returns corps de réponse
 */
async function readMe(runtime: IdentityRuntime, call: ActionCall): Promise<unknown> {
  const context = requireContext(call.context);
  return identityRead(runtime, context.organisationId, async (dependencies) => {
    const user = await dependencies.users.findById(userOf(context));
    const organisation = await dependencies.organisations.findById(context.organisationId);
    if (user === undefined || organisation === undefined) return err(domainError('identity.user_not_found', 'not_found', 'Utilisateur introuvable.'));
    const session = call.sessionSecret === null ? undefined : await dependencies.sessions.findBySecretHash(runtime.secrets.hashSecret(call.sessionSecret));
    const totp = await dependencies.mfa.findTotp(user.id);
    const apiKey = await dependencies.credentials.findActiveKeyOf(user.id);
    const mfaVerifiedAt = context.credential.kind === 'session' ? context.credential.mfaVerifiedAt : null;
    return ok({
      user: { id: user.id, email: user.email, displayName: user.displayName, theme: user.theme },
      organisation: { id: organisation.id, slug: organisation.slug, name: organisation.name },
      permissions: await organisationPermissions(dependencies, context),
      mfa: { enrolled: totp?.confirmed === true, verifiedAt: isoOrNull(mfaVerifiedAt) },
      apiKey: apiKeyBody(apiKey),
      csrfToken: session?.csrfToken ?? null,
    });
  });
}

/**
 * Déclare les actions (partie 1).
 * @param runtime environnement
 * @returns actions
 */
function meActionsPart1(runtime: IdentityRuntime): RegisteredAction[] {
  return [
    {
      definition: defineAction({ id: 'me.get', permission: 'self', risk: 'R0', method: 'GET', path: '/me', reversible: true, description: 'Retourne mon profil, mon organisation et mes permissions.', rules: [] }),
      handle: async (call) => ({ status: 200, body: await readMe(runtime, call) }),
    },
    {
      definition: defineAction({ id: 'me.update', permission: 'self', risk: 'R1', method: 'PATCH', path: '/me', reversible: true, description: 'Modifie mon nom affiché ou mon thème.', rules: [] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const input = parseInput(ProfileInput, call.body);
        const changes = { ...(input.displayName === undefined ? {} : { displayName: input.displayName }), ...(input.theme === undefined ? {} : { theme: input.theme }) };
        return identityWrite(runtime, call, { actionId: 'me.update', resourceType: 'user', context, replayable: true, changedFields: Object.keys(changes), execute: async (dependencies) => updateProfile(dependencies, userOf(context), changes), respond: (user) => ({ status: 200, body: { id: user.id, displayName: user.displayName, theme: user.theme }, etag: user.version }), resourceId: (user) => user.id });
      },
    },
  ];
}

/**
 * Déclare les actions (partie 2).
 * @param runtime environnement
 * @returns actions
 */
function meActionsPart2(runtime: IdentityRuntime): RegisteredAction[] {
  return [
    {
      definition: defineAction({ id: 'mfa.totp_start', permission: 'self', risk: 'R1', method: 'POST', path: '/me/mfa/totp', reversible: true, description: "Démarre l'enrôlement d'une application d'authentification (TOTP).", rules: [] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        return identityWrite(runtime, call, { actionId: 'mfa.totp_start', resourceType: 'mfa_factor', context, replayable: false, execute: async (dependencies) => startTotpEnrollment(dependencies, userOf(context)), respond: (result) => ({ status: 201, body: result }), resourceId: () => userOf(context) });
      },
    },
    {
      definition: defineAction({ id: 'mfa.totp_confirm', permission: 'self', risk: 'R1', method: 'POST', path: '/me/mfa/totp/confirm', reversible: false, description: "Confirme l'enrôlement TOTP et remet les codes de récupération.", rules: [] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const input = parseInput(CodeInput, call.body);
        return identityWrite(runtime, call, { actionId: 'mfa.totp_confirm', resourceType: 'mfa_factor', context, replayable: false, execute: async (dependencies) => confirmTotpEnrollment(dependencies, userOf(context), input.code), respond: (result) => ({ status: 200, body: result }), resourceId: () => userOf(context) });
      },
    },
  ];
}

/**
 * Déclare les actions (partie 3).
 * @param runtime environnement
 * @returns actions
 */
function meActionsPart3(runtime: IdentityRuntime): RegisteredAction[] {
  return [
    {
      definition: defineAction({ id: 'api_key.create', permission: 'api_key:manage_own', risk: 'R3', method: 'POST', path: '/me/api-key', reversible: false, description: 'Crée ou régénère ma clé API personnelle (affichée une seule fois).', rules: ['RG-IAM-003'] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const input = parseInput(ApiKeyInput, call.body);
        return identityWrite(runtime, call, { actionId: 'api_key.create', resourceType: 'api_key', context, replayable: false, changedFields: ['name', 'readOnly'], execute: async (dependencies) => createApiKey(dependencies, context, input), respond: (result) => ({ status: 201, body: { token: result.token, publicId: result.key.publicId, name: result.key.name, readOnly: result.key.readOnly } }), resourceId: (result) => result.key.id });
      },
    },
    {
      definition: defineAction({ id: 'api_key.revoke', permission: 'api_key:manage_own', risk: 'R3', method: 'DELETE', path: '/me/api-key', reversible: false, description: 'Révoque ma clé API personnelle.', rules: ['RG-IAM-003'] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        return identityWrite(runtime, call, { actionId: 'api_key.revoke', resourceType: 'api_key', context, replayable: true, execute: async (dependencies) => revokeApiKey(dependencies, context), respond: () => ({ status: 204, body: null }), resourceId: () => null });
      },
    },
  ];
}

/**
 * Déclare les actions du profil.
 * @param runtime environnement identity
 * @returns actions enregistrées
 */
export function meActions(runtime: IdentityRuntime): RegisteredAction[] {
  return [...meActionsPart1(runtime), ...meActionsPart2(runtime), ...meActionsPart3(runtime)];
}
