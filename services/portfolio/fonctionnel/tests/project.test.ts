/**
 * Tests du cycle de vie des projets.
 *
 * Couche : basse (portfolio). Règles vérifiées : RG-PRJ-001, RG-PRJ-003, RG-PRJ-004, RG-PRJ-005, RG-PRJ-006,
 * RG-PRJ-007.
 */
import { toEntityId } from '@pajavamba/kernel';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  canReopen,
  closureBlockers,
  DELETION_GRACE_MS,
  DRAFT_DELETION_GRACE_MS,
  isReadOnly,
  REOPEN_WINDOW_MS,
  transition,
  validateProjectKey,
  type Project,
  type ProjectStatus,
} from '../src/index.ts';

const DAY_MS = 86_400_000;
const CLOSED_AT = 1_800_000_000_000;

/**
 * Projet de test.
 * @param change propriétés à remplacer
 * @returns projet
 */
function project(change: Partial<Project> = {}): Project {
  return {
    id: toEntityId('0192f7c4-5a1e-7c3b-9d2e-4b8f6a1c2d3e'),
    organisationId: toEntityId('0192f7c4-5a1e-7c3b-9d2e-4b8f6a1c2d3f'),
    key: 'PAJA',
    name: 'Projet de test',
    description: '',
    status: 'active',
    visibility: 'internal',
    methodologyPackKey: 'scrum',
    timeZone: 'Europe/Paris',
    configurationReady: true,
    openItemCount: 0,
    createdBy: null,
    closedAt: null,
    closureSummary: null,
    archivedAt: null,
    deletionScheduledFor: null,
    deletionFromStatus: null,
    version: 1,
    ...change,
  };
}

describe('clé de projet (RG-PRJ-001)', () => {
  it('accepte une majuscule suivie de 1 à 9 majuscules ou chiffres', () => {
    for (const key of ['PA', 'PAJA', 'P1', 'ABCDEFGHIJ']) expect(validateProjectKey(key).ok).toBe(true);
  });

  it('refuse une clé trop courte, trop longue, en minuscules ou commençant par un chiffre', () => {
    for (const key of ['P', 'ABCDEFGHIJK', 'paja', '1PAJA', 'PA-JA', '']) expect(validateProjectKey(key).ok).toBe(false);
  });

  it('accepte exactement les clés conformes au motif, pour toute chaîne', () => {
    expect(() => {
      fc.assert(fc.property(fc.string({ maxLength: 12 }), (key) => validateProjectKey(key).ok === /^[A-Z][A-Z0-9]{1,9}$/u.test(key)));
    }).not.toThrow();
  });
});

describe('transitions du cycle de vie (RG-PRJ-003)', () => {
  it('applique une transition admise et incrémente la version', () => {
    const result = transition(project({ status: 'draft' }), { action: 'activer', from: ['draft'], change: { status: 'active' } });
    expect(result.ok && result.value).toMatchObject({ status: 'active', version: 2 });
  });

  it('refuse une transition depuis un statut non admis', () => {
    expect(transition(project({ status: 'archived' }), { action: 'activer', from: ['draft'], change: { status: 'active' } }).ok).toBe(false);
  });
});

describe('lecture seule (RG-PRJ-004)', () => {
  it('met en lecture seule un projet clôturé, archivé ou en suppression programmée', () => {
    const readOnly: ProjectStatus[] = ['closed', 'archived', 'pending_deletion'];
    for (const status of readOnly) expect(isReadOnly(project({ status }))).toBe(true);
    for (const status of ['draft', 'active'] as const) expect(isReadOnly(project({ status }))).toBe(false);
  });
});

describe('conditions de clôture (RG-PRJ-005)', () => {
  it('autorise la clôture d’un projet actif sans élément ouvert', () => {
    expect(closureBlockers(project())).toEqual([]);
  });

  it('bloque la clôture tant que des éléments sont ouverts', () => {
    expect(closureBlockers(project({ openItemCount: 2 })).map((blocker) => blocker.code)).toEqual(['open_items']);
  });

  it('bloque la clôture d’un projet qui n’est pas actif', () => {
    expect(closureBlockers(project({ status: 'draft' })).map((blocker) => blocker.code)).toContain('not_active');
  });
});

describe('réouverture (RG-PRJ-006)', () => {
  it('autorise la réouverture jusqu’à 90 jours après la clôture, pas au-delà', () => {
    const closed = project({ status: 'closed', closedAt: CLOSED_AT });
    expect(REOPEN_WINDOW_MS).toBe(90 * DAY_MS);
    expect(canReopen(closed, CLOSED_AT + REOPEN_WINDOW_MS)).toBe(true);
    expect(canReopen(closed, CLOSED_AT + REOPEN_WINDOW_MS + 1)).toBe(false);
  });

  it('refuse la réouverture d’un projet jamais clôturé', () => {
    expect(canReopen(project(), CLOSED_AT)).toBe(false);
  });
});

describe('délais de grâce avant purge (RG-PRJ-007)', () => {
  it('fixe 30 jours pour un projet et 7 jours pour un brouillon', () => {
    expect(DELETION_GRACE_MS).toBe(30 * DAY_MS);
    expect(DRAFT_DELETION_GRACE_MS).toBe(7 * DAY_MS);
  });
});
