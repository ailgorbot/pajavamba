/**
 * Tests de la visibilité des éléments : confidentialité et corbeille.
 *
 * Couche : basse (workitem). Règles vérifiées : RG-WI-007, RG-WI-008, RI-SEC-03.
 */
import { toEntityId, type AccessRequest, type ExecutionContext } from '@pajavamba/kernel';
import { describe, expect, it } from 'vitest';
import { loadItem, READ, type WorkItem, type WorkItemDependencies } from '../src/index.ts';

const PROJECT = { id: toEntityId<'project'>('0192f7c4-5a1e-7c3b-9d2e-4b8f6a1c2d3e'), key: 'PAJA', status: 'active' };
const CONTEXT = {
  organisationId: toEntityId('0192f7c4-5a1e-7c3b-9d2e-4b8f6a1c2d3f'),
  actor: { kind: 'user', userId: toEntityId('0192f7c4-5a1e-7c3b-9d2e-4b8f6a1c2d40') },
  channel: 'ui',
  credential: { kind: 'session', mfaVerifiedAt: null },
  correlationId: toEntityId('0192f7c4-5a1e-7c3b-9d2e-4b8f6a1c2d41'),
} as ExecutionContext;

/**
 * Dépendances simulées : un projet, un élément et les permissions accordées à l'acteur.
 * @param item élément stocké
 * @param permissions permissions accordées
 * @returns dépendances
 */
function dependencies(item: Partial<WorkItem>, permissions: readonly string[]): WorkItemDependencies {
  const stored = { id: 'element-1', projectId: PROJECT.id, key: 'PAJA-1', confidentiality: 'normal', deletedAt: null, ...item } as WorkItem;
  return {
    configuration: { findProject: async () => Promise.resolve(PROJECT) },
    items: { findByKey: async () => Promise.resolve(stored), findById: async () => Promise.resolve(stored) },
    policy: {
      authorize: async (_context: ExecutionContext, request: AccessRequest) => Promise.resolve(permissions.includes(request.permission) ? { allowed: true } : { allowed: false, reason: 'no_grant' }),
    },
  } as unknown as WorkItemDependencies;
}

const ACCESS = { ...READ, ref: { key: 'PAJA' }, itemRef: 'PAJA-1' };

describe('élément confidentiel (RG-WI-007)', () => {
  it('reste invisible sans la permission work_item:read_restricted, comme s’il n’existait pas', async () => {
    const result = await loadItem(dependencies({ confidentiality: 'restricted' }, ['work_item:read']), CONTEXT, ACCESS);
    expect(!result.ok && result.error.code).toBe('workitem.not_found');
  });

  it('est visible avec la permission work_item:read_restricted', async () => {
    const result = await loadItem(dependencies({ confidentiality: 'restricted' }, ['work_item:read', 'work_item:read_restricted']), CONTEXT, ACCESS);
    expect(result.ok).toBe(true);
  });
});

describe('corbeille (RG-WI-008)', () => {
  it('masque un élément supprimé dans les accès ordinaires', async () => {
    const result = await loadItem(dependencies({ deletedAt: 1_000 }, ['work_item:read']), CONTEXT, ACCESS);
    expect(!result.ok && result.error.code).toBe('workitem.not_found');
  });

  it('retrouve un élément supprimé quand la corbeille est consultée', async () => {
    const result = await loadItem(dependencies({ deletedAt: 1_000 }, ['work_item:read']), CONTEXT, { ...ACCESS, includeDeleted: true });
    expect(result.ok).toBe(true);
  });
});
