/**
 * Racine de composition du service identity (câblage manuel, RI-ARC-09).
 *
 * Couche : moyenne (identity/structure).
 */
import { join } from 'node:path';
import type { EventConsumer, IdentityClient, RegisteredAction } from '@pajavamba/contracts';
import type { MigrationSet } from '@pajavamba/ops';
import { meActions } from '../actions/me.actions.ts';
import { sessionActions } from '../actions/session.actions.ts';
import { userActions } from '../actions/users.actions.ts';
import { createProjectRolesConsumer } from '../evenements/project-roles.consumer.ts';
import { createIdentityClient } from './identity-client.ts';
import type { IdentityRuntime } from './identity-runtime.ts';

export { createIdentityRuntime, type IdentityRuntime, type IdentitySettings } from './identity-runtime.ts';
export { createSecretService, type InstanceSecrets } from '../securite/secret-service.adapter.ts';

/** Migrations du service identity. */
export const IDENTITY_MIGRATIONS: MigrationSet = { service: 'identity', directory: join(import.meta.dirname, '../../migrations') };

/** Service identity câblé. */
export interface IdentityService {
  readonly actions: readonly RegisteredAction[];
  readonly consumers: readonly EventConsumer[];
  readonly client: IdentityClient;
}

/**
 * Câble le service identity.
 * @param runtime environnement
 * @returns service câblé
 */
export function createIdentityService(runtime: IdentityRuntime): IdentityService {
  return {
    actions: [...sessionActions(runtime), ...meActions(runtime), ...userActions(runtime)],
    consumers: [createProjectRolesConsumer(runtime)],
    client: createIdentityClient(runtime),
  };
}
