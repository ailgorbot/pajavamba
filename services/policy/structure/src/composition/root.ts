/**
 * Racine de composition du service policy (câblage manuel, RI-ARC-09).
 *
 * Couche : moyenne (policy/structure).
 */
import { join } from 'node:path';
import type { EventConsumer } from '@pajavamba/contracts';
import type { AccessPolicy, Clock } from '@pajavamba/kernel';
import type { MigrationSet } from '@pajavamba/ops';
import type pg from 'pg';
import { createIdentityProjectionConsumer } from '../evenements/identity-projection.consumer.ts';
import { createAccessPolicy } from '../politique/access-policy.adapter.ts';

/** Service policy câblé. */
export interface PolicyService {
  readonly accessPolicy: AccessPolicy;
  readonly consumers: readonly EventConsumer[];
}

/** Migrations du service policy. */
export const POLICY_MIGRATIONS: MigrationSet = { service: 'policy', directory: join(import.meta.dirname, '../../migrations') };

/**
 * Câble le service policy.
 * @param pool pool PostgreSQL
 * @param clock horloge
 * @returns service câblé
 */
export function createPolicyService(pool: pg.Pool, clock: Clock): PolicyService {
  return { accessPolicy: createAccessPolicy(pool, clock), consumers: [createIdentityProjectionConsumer(pool)] };
}
