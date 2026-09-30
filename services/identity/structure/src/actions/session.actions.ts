/**
 * Actions d'initialisation et de session : état de l'instance, initialisation, connexion,
 * déconnexion, sessions, MFA récente.
 *
 * Couche : moyenne (identity/structure). Règles : RI-API-01, RI-SEC-04 (seules l'initialisation et
 * la connexion sont publiques), RI-CNX-04 (cookie `__Host-pv_session`), RI-CNX-09.
 */
import { defineAction, type ActionCall, type RegisteredAction } from '@pajavamba/contracts';
import { initializeInstance, INVALID_CREDENTIALS, listMySessions, openSession, revokeMySession, SESSION_ABSOLUTE_TTL_MS, verifyRecentMfa } from '@pajavamba/identity-fonctionnel';
import { ok, toEntityId } from '@pajavamba/kernel';
import { parseInput, problemFromDomainError, requireContext, UNAUTHENTICATED, uuidv7, withTransaction } from '@pajavamba/ops';
import { z } from 'zod';
import { IDENTITY_SCOPE, identityRead, identityWrite, publicContext, type IdentityRuntime } from '../composition/identity-runtime.ts';

const MILLIS_PER_SECOND = 1_000;
const SESSION_MAX_AGE_SECONDS = SESSION_ABSOLUTE_TTL_MS / MILLIS_PER_SECOND;

const SetupInput = z.strictObject({
  setupCode: z.string().min(1).max(200).describe("Code d'initialisation généré à l'installation"),
  organisationName: z.string().max(120).describe("Nom de l'organisation"),
  organisationSlug: z.string().max(40).describe("Identifiant lisible de l'organisation"),
  email: z.email().max(320).describe('Adresse du propriétaire'),
  displayName: z.string().max(120).describe('Nom affiché du propriétaire'),
  password: z.string().max(256).describe('Mot de passe (12 caractères minimum)'),
});

const LoginInput = z.strictObject({
  email: z.string().max(320).describe('Adresse électronique'),
  password: z.string().max(256).describe('Mot de passe'),
  totpCode: z.string().max(10).optional().describe('Code à usage unique, si la MFA est activée'),
});

const MfaInput = z.strictObject({ code: z.string().min(6).max(10).describe('Code à usage unique') });

/**
 * Déclare les actions (partie 1).
 * @param runtime environnement
 * @returns actions
 */
function sessionActionsPart1(runtime: IdentityRuntime): RegisteredAction[] {
  return [
    {
      definition: defineAction({ id: 'instance.status', permission: 'public', risk: 'R0', method: 'GET', path: '/setup', reversible: true, description: "Indique si l'instance est initialisée.", rules: [] }),
      handle: async () => {
        const count = await withTransaction(runtime.pool, IDENTITY_SCOPE, (tx) => runtime.dependenciesOf(tx).organisations.count());
        return { status: 200, body: { initialized: count > 0 } };
      },
    },
    {
      definition: defineAction({ id: 'instance.initialize', permission: 'public', risk: 'R1', method: 'POST', path: '/setup', reversible: false, description: "Initialise l'instance : organisation et propriétaire.", rules: ['RG-ORG-001', 'RG-ORG-002'] }),
      handle: async (call) => {
        const input = parseInput(SetupInput, call.body);
        const organisationId = toEntityId<'organisation'>(uuidv7(Date.now()));
        return identityWrite(runtime, call, {
          actionId: 'instance.initialize', resourceType: 'organisation', context: { ...publicContext(call), organisationId }, replayable: false, changedFields: ['slug', 'name'],
          execute: async (dependencies) => initializeInstance(dependencies, { ...input, organisationId }),
          respond: (result) => ({ status: 201, body: { organisationId: result.organisationId } }),
          resourceId: (result) => result.organisationId,
        });
      },
    },
  ];
}

/**
 * Révoque la session courante, si le cookie en désigne une (déconnexion).
 * @param runtime environnement identity
 * @param call appel
 */
async function closeCurrentSession(runtime: IdentityRuntime, call: ActionCall): Promise<void> {
  const context = requireContext(call.context);
  const secret = call.sessionSecret;
  if (secret === null) return;
  const session = await withTransaction(runtime.pool, IDENTITY_SCOPE, (tx) => runtime.dependenciesOf(tx).sessions.findBySecretHash(runtime.secrets.hashSecret(secret)));
  if (session === undefined) return;
  await identityWrite(runtime, call, { actionId: 'session.close', resourceType: 'session', context, replayable: false, execute: async (dependencies) => revokeMySession(dependencies, context, session.id), respond: () => ({ status: 204, body: null }), resourceId: () => session.id });
}

/**
 * Déclare les actions (partie 2).
 * @param runtime environnement
 * @returns actions
 */
function sessionActionsPart2(runtime: IdentityRuntime): RegisteredAction[] {
  return [
    {
      definition: defineAction({ id: 'session.open', permission: 'public', risk: 'R1', method: 'POST', path: '/sessions', reversible: true, description: 'Ouvre une session avec un compte local.', rules: [] }),
      handle: async (call) => {
        const input = parseInput(LoginInput, call.body);
        const response = await identityWrite(runtime, call, {
          actionId: 'session.open', resourceType: 'session', context: publicContext(call), replayable: false,
          execute: async (dependencies) => openSession(dependencies, { email: input.email, password: input.password, totpCode: input.totpCode ?? null }),
          respond: (result) => (result.status === 'opened'
            ? { status: 201, body: { csrfToken: result.csrfToken }, sessionCookie: { set: result.sessionSecret, maxAgeSeconds: SESSION_MAX_AGE_SECONDS } }
            : { status: 403, body: null }),
          resourceId: (result) => result.userId,
        });
        if (response.status === 403) throw problemFromDomainError(INVALID_CREDENTIALS);
        return response;
      },
    },
    {
      definition: defineAction({ id: 'session.close', permission: 'self', risk: 'R1', method: 'DELETE', path: '/sessions/current', reversible: false, description: 'Ferme la session courante (déconnexion).', rules: [] }),
      handle: async (call) => {
        await closeCurrentSession(runtime, call);
        return { status: 204, body: null, sessionCookie: { clear: true } };
      },
    },
  ];
}

/**
 * Déclare les actions (partie 3).
 * @param runtime environnement
 * @returns actions
 */
function sessionActionsPart3(runtime: IdentityRuntime): RegisteredAction[] {
  return [
    {
      definition: defineAction({ id: 'session.list', permission: 'self', risk: 'R0', method: 'GET', path: '/me/sessions', reversible: true, description: 'Liste mes sessions actives.', rules: [] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const userId = context.actor.kind === 'user' ? context.actor.userId : undefined;
        const sessions = userId === undefined ? [] : await identityRead(runtime, context.organisationId, async (dependencies) => ok(await listMySessions(dependencies, userId)));
        return { status: 200, body: { data: sessions.map((session) => ({ id: session.id, createdAt: new Date(session.createdAt).toISOString(), lastSeenAt: new Date(session.lastSeenAt).toISOString(), mfa: session.mfaVerifiedAt !== null })), page: { nextCursor: null, limit: sessions.length } } };
      },
    },
    {
      definition: defineAction({ id: 'session.revoke', permission: 'self', risk: 'R1', method: 'DELETE', path: '/me/sessions/:sessionId', reversible: false, description: "Révoque l'une de mes sessions.", rules: ['RG-IAM-005'] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const sessionId = call.params['sessionId'] ?? '';
        return identityWrite(runtime, call, { actionId: 'session.revoke', resourceType: 'session', context, replayable: true, execute: async (dependencies) => revokeMySession(dependencies, context, sessionId), respond: () => ({ status: 204, body: null }), resourceId: () => sessionId });
      },
    },
  ];
}

/**
 * Déclare les actions (partie 4).
 * @param runtime environnement
 * @returns actions
 */
function sessionActionsPart4(runtime: IdentityRuntime): RegisteredAction[] {
  return [
    {
      definition: defineAction({ id: 'mfa.verify', permission: 'self', risk: 'R1', method: 'POST', path: '/me/mfa/verify', reversible: true, description: 'Vérifie un code MFA pour la session courante (MFA récente).', rules: ['RG-IAM-003'] }),
      handle: async (call) => {
        const context = requireContext(call.context);
        const input = parseInput(MfaInput, call.body);
        const session = await withTransaction(runtime.pool, IDENTITY_SCOPE, (tx) => runtime.dependenciesOf(tx).sessions.findBySecretHash(runtime.secrets.hashSecret(call.sessionSecret ?? '')));
        if (session === undefined) throw UNAUTHENTICATED;
        return identityWrite(runtime, call, { actionId: 'mfa.verify', resourceType: 'session', context, replayable: false, execute: async (dependencies) => verifyRecentMfa(dependencies, session.id, input.code), respond: () => ({ status: 204, body: null }), resourceId: () => session.id });
      },
    },
  ];
}

/**
 * Déclare les actions de session.
 * @param runtime environnement identity
 * @returns actions enregistrées
 */
export function sessionActions(runtime: IdentityRuntime): RegisteredAction[] {
  return [...sessionActionsPart1(runtime), ...sessionActionsPart2(runtime), ...sessionActionsPart3(runtime), ...sessionActionsPart4(runtime)];
}
