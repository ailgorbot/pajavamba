/**
 * Tests des règles d'organisation et de désactivation des utilisateurs.
 *
 * Couche : basse (identity). Règles vérifiées : RG-ORG-001, RG-ORG-002, RG-IAM-005, RI-CNX-10.
 */
import { toEntityId, type ExecutionContext, type UserId } from '@pajavamba/kernel';
import { describe, expect, it } from 'vitest';
import { deactivateUser, validateSlug, type IdentityDependencies, type Membership, type OrganisationRole, type User } from '../src/index.ts';

const ORGANISATION = toEntityId<'organisation'>('0192f7c4-5a1e-7c3b-9d2e-4b8f6a1c2d3e');
const ADMIN = toEntityId<'user'>('0192f7c4-5a1e-7c3b-9d2e-4b8f6a1c2d41');
const TARGET = toEntityId<'user'>('0192f7c4-5a1e-7c3b-9d2e-4b8f6a1c2d42');
const NOW = 1_800_000_000_000;

const CONTEXT = {
  organisationId: ORGANISATION,
  actor: { kind: 'user', userId: ADMIN },
  channel: 'ui',
  credential: { kind: 'session', mfaVerifiedAt: NOW },
  correlationId: toEntityId('0192f7c4-5a1e-7c3b-9d2e-4b8f6a1c2d43'),
} as ExecutionContext;

/** Appels enregistrés par les dépendances simulées. */
interface Calls {
  readonly updated: User[];
  readonly revokedSessions: UserId[];
  readonly revokedKeys: UserId[];
}

/**
 * Dépendances simulées pour la désactivation (autorisation accordée).
 * @param role rôle d'organisation de l'utilisateur visé
 * @param owners nombre de propriétaires actifs
 * @returns dépendances et appels
 */
function dependencies(role: OrganisationRole, owners: number): { deps: IdentityDependencies; calls: Calls } {
  const calls: Calls = { updated: [], revokedSessions: [], revokedKeys: [] };
  const user: User = { id: TARGET, email: 'cible@example.org', displayName: 'Cible', status: 'active', theme: 'system', passwordHash: null, failedLoginCount: 0, lastFailedLoginAt: null, version: 3 };
  const membership: Membership = { organisationId: ORGANISATION, userId: TARGET, orgRole: role, status: 'active' };
  const deps = {
    policy: { authorize: async () => Promise.resolve({ allowed: true }), projectsWith: async () => Promise.resolve({ all: true }) },
    users: { findById: async () => Promise.resolve(user), update: async (next: User) => Promise.resolve(calls.updated.push(next)) },
    organisations: { findMembership: async () => Promise.resolve(membership) },
    assignments: { countOwners: async () => Promise.resolve(owners) },
    sessions: { revokeAllOf: async (id: UserId) => Promise.resolve(calls.revokedSessions.push(id)) },
    credentials: { revokeKeysOf: async (id: UserId) => Promise.resolve(calls.revokedKeys.push(id)) },
    clock: { now: () => NOW },
  } as unknown as IdentityDependencies;
  return { deps, calls };
}

describe('slug d’organisation (RG-ORG-002)', () => {
  it('accepte 3 à 40 caractères parmi a-z, 0-9 et « - »', () => {
    for (const slug of ['abc', 'ma-collectivite', 'a'.repeat(40), 'org-2026']) expect(validateSlug(slug).ok).toBe(true);
  });

  it('refuse un slug trop court, trop long, en majuscules ou avec des caractères interdits', () => {
    for (const slug of ['ab', 'a'.repeat(41), 'Mairie', 'ma collectivite', 'org_2026', 'élan']) expect(validateSlug(slug).ok).toBe(false);
  });
});

describe('désactivation d’un utilisateur (RG-IAM-005, RG-ORG-001)', () => {
  it('révoque immédiatement les sessions et les clés de l’utilisateur désactivé (RG-IAM-005)', async () => {
    const { deps, calls } = dependencies('member', 1);
    const result = await deactivateUser(deps, CONTEXT, TARGET);
    expect(result.ok).toBe(true);
    expect(calls.updated[0]?.status).toBe('deactivated');
    expect(calls.revokedSessions).toEqual([TARGET]);
    expect(calls.revokedKeys).toEqual([TARGET]);
  });

  it('refuse de désactiver le dernier propriétaire actif, sans rien révoquer (RG-ORG-001)', async () => {
    const { deps, calls } = dependencies('owner', 1);
    const result = await deactivateUser(deps, CONTEXT, TARGET);
    expect(!result.ok && result.error.code).toBe('identity.last_owner');
    expect(calls.revokedSessions).toEqual([]);
  });

  it('autorise la désactivation d’un propriétaire quand il en reste un autre (RG-ORG-001)', async () => {
    const { deps } = dependencies('owner', 2);
    expect((await deactivateUser(deps, CONTEXT, TARGET)).ok).toBe(true);
  });

  it('refuse qu’un utilisateur désactive son propre compte', async () => {
    const { deps } = dependencies('member', 1);
    const result = await deactivateUser(deps, CONTEXT, ADMIN);
    expect(!result.ok && result.error.code).toBe('identity.self_deactivation');
  });
});
