/**
 * Environnement d'exécution du service identity : dépendances par transaction et exécution des actions.
 *
 * Couche : moyenne (identity/structure). Règles : RI-ARC-09 (câblage manuel), RI-ARC-11.
 */
import type { ActionCall, ActionResponse } from '@pajavamba/contracts';
import type { IdentityDependencies, SecretService } from '@pajavamba/identity-fonctionnel';
import { toEntityId, type AccessPolicy, type Clock, type DomainError, type ExecutionContext, type IdGenerator, type Result } from '@pajavamba/kernel';
import { serviceRead, serviceWrite, type ServiceRuntimeShape, type ServiceWrite, type SqlExecutor } from '@pajavamba/ops';
import type pg from 'pg';
import { assignmentRepository } from '../persistance/assignment.repository.ts';
import { credentialRepository, mfaRepository } from '../persistance/credential.repository.ts';
import { organisationRepository } from '../persistance/organisation.repository.ts';
import { sessionRepository } from '../persistance/session.repository.ts';
import { userRepository } from '../persistance/user.repository.ts';

/** Portée PostgreSQL du service identity. */
export const IDENTITY_SCOPE = { schema: 'identity', role: 'pv_identity_app' } as const;

/** Paramètres de l'environnement identity. */
export interface IdentitySettings {
  readonly pool: pg.Pool;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly secrets: SecretService;
  readonly fieldKey: Buffer;
  readonly policy: AccessPolicy;
  readonly notify: () => void;
}

/** Environnement du service identity. */
export interface IdentityRuntime extends ServiceRuntimeShape<IdentityDependencies> {
  readonly secrets: SecretService;
}

/**
 * Construit l'environnement du service identity.
 * @param settings paramètres
 * @returns environnement
 */
export function createIdentityRuntime(settings: IdentitySettings): IdentityRuntime {
  return {
    pool: settings.pool,
    scope: IDENTITY_SCOPE,
    notify: settings.notify,
    secrets: settings.secrets,
    dependenciesOf: (tx: SqlExecutor): IdentityDependencies => ({
      organisations: organisationRepository(tx),
      users: userRepository(tx),
      sessions: sessionRepository(tx),
      assignments: assignmentRepository(tx),
      mfa: mfaRepository(tx, settings.fieldKey),
      credentials: credentialRepository(tx),
      secrets: settings.secrets,
      policy: settings.policy,
      clock: settings.clock,
      ids: settings.ids,
    }),
  };
}

/**
 * Contexte d'une action publique (connexion, initialisation) : aucun acteur authentifié.
 * @param call appel
 * @returns contexte système sans organisation
 */
export function publicContext(call: ActionCall): ExecutionContext {
  return { organisationId: toEntityId(''), actor: { kind: 'system' }, channel: 'ui', credential: { kind: 'internal' }, correlationId: toEntityId(call.correlationId) };
}

/**
 * Exécute une écriture identity.
 * @param runtime environnement
 * @param call appel
 * @param write description
 * @returns réponse
 */
export async function identityWrite<T>(runtime: IdentityRuntime, call: ActionCall, write: ServiceWrite<IdentityDependencies, T, ActionResponse>): Promise<ActionResponse> {
  return serviceWrite(runtime, call, write);
}

/**
 * Exécute une lecture identity.
 * @param runtime environnement
 * @param organisationId organisation
 * @param read lecture
 * @returns valeur lue
 */
export async function identityRead<T>(runtime: IdentityRuntime, organisationId: string, read: (dependencies: IdentityDependencies) => Promise<Result<T, DomainError>>): Promise<T> {
  return serviceRead(runtime, organisationId, read);
}
