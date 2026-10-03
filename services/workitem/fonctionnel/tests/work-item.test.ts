/**
 * Tests des règles des éléments de travail : clé, hiérarchie, transitions, rang.
 *
 * Couche : basse (workitem). Règles vérifiées : RG-WI-001, RG-WI-002, RG-WI-003, RG-WI-005, RG-WF-004, RG-WF-005.
 */
import { toEntityId } from '@pajavamba/kernel';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkParent, evaluateTransition, itemKey, MAX_DEPTH, rankBetween, type ItemType, type WorkflowSnapshot, type WorkItem } from '../src/index.ts';

/**
 * Élément de test.
 * @param change propriétés à remplacer
 * @returns élément
 */
function item(change: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 'element-1',
    projectId: toEntityId('0192f7c4-5a1e-7c3b-9d2e-4b8f6a1c2d3e'),
    number: 1,
    key: 'PAJA-1',
    typeKey: 'story',
    title: 'Élément de test',
    description: '',
    acceptanceCriteria: '',
    stateKey: 'todo',
    stateCategory: 'todo',
    workflowVersionId: 'version-1',
    priority: 'medium',
    parentId: null,
    ancestors: [],
    assigneeId: null,
    reporterId: null,
    estimate: null,
    rank: 'm',
    confidentiality: 'normal',
    createdVia: 'ui',
    createdAt: 0,
    resolvedAt: null,
    deletedAt: null,
    version: 1,
    ...change,
  };
}

const STORY: ItemType = { key: 'story', name: 'Story', level: 2, allowedParentKeys: ['epic'], workflowKey: 'scrum' };

const SNAPSHOT: WorkflowSnapshot = {
  versionId: 'version-1',
  workflowKey: 'scrum',
  number: 1,
  states: [
    { key: 'todo', name: 'À faire', category: 'todo', wipLimit: null, wipBlocking: false },
    { key: 'in_progress', name: 'En cours', category: 'in_progress', wipLimit: 2, wipBlocking: true },
    { key: 'done', name: 'Terminé', category: 'done', wipLimit: null, wipBlocking: false },
  ],
  transitions: [
    { key: 'start', name: 'Démarrer', from: 'todo', to: 'in_progress', conditions: [{ kind: 'field_set', field: 'assignee' }], requiresApproval: false },
    { key: 'finish', name: 'Terminer', from: 'in_progress', to: 'done', conditions: [{ kind: 'children_done' }], requiresApproval: false },
  ],
};

const FACTS = { openChildren: 0, targetCount: 0 };

describe('clé d’un élément (RG-WI-001)', () => {
  it('compose la clé du projet et le numéro séquentiel', () => {
    expect(itemKey('PAJA', 42)).toBe('PAJA-42');
  });
});

describe('hiérarchie (RG-WI-002, RG-WI-003)', () => {
  it('accepte un parent d’un type autorisé et renvoie le chemin des ancêtres', () => {
    const result = checkParent(STORY, null, item({ id: 'epic-1', typeKey: 'epic', ancestors: ['racine'] }));
    expect(result.ok && result.value).toEqual(['racine', 'epic-1']);
  });

  it('refuse un parent d’un type non autorisé (RG-WI-002)', () => {
    const result = checkParent(STORY, null, item({ id: 'task-1', typeKey: 'task' }));
    expect(!result.ok && result.error.code).toBe('workitem.parent_type_not_allowed');
  });

  it('refuse un rattachement qui créerait un cycle (RG-WI-003)', () => {
    const result = checkParent(STORY, 'element-1', item({ id: 'epic-1', typeKey: 'epic', ancestors: ['element-1'] }));
    expect(!result.ok && result.error.code).toBe('workitem.hierarchy_cycle');
  });

  it('refuse une hiérarchie plus profonde que 7 niveaux', () => {
    const ancestors = Array.from({ length: MAX_DEPTH - 1 }, (_, index) => `ancetre-${String(index)}`);
    const result = checkParent(STORY, null, item({ id: 'epic-1', typeKey: 'epic', ancestors }));
    expect(!result.ok && result.error.code).toBe('workitem.hierarchy_too_deep');
  });
});

describe('transitions de workflow (RG-WI-005, RG-WF-004, RG-WF-005)', () => {
  it('refuse une transition « validation requise » sans validation humaine (RG-WF-005)', () => {
    const snapshot: WorkflowSnapshot = { ...SNAPSHOT, transitions: [{ key: 'approve', name: 'Valider', from: 'todo', to: 'done', conditions: [], requiresApproval: true }] };
    const result = evaluateTransition(snapshot, item(), { targetKey: 'done', facts: FACTS });
    expect(!result.ok && result.error.code).toBe('workitem.approval_required');
  });

  it('autorise une transition de la version rattachée dont les conditions sont remplies', () => {
    const result = evaluateTransition(SNAPSHOT, item({ assigneeId: toEntityId('0192f7c4-5a1e-7c3b-9d2e-4b8f6a1c2d40') }), { targetKey: 'in_progress', facts: FACTS });
    expect(result.ok && result.value.key).toBe('in_progress');
  });

  it('refuse un état cible sans transition depuis l’état courant', () => {
    const result = evaluateTransition(SNAPSHOT, item(), { targetKey: 'done', facts: FACTS });
    expect(!result.ok && result.error.code).toBe('workitem.transition_not_allowed');
  });

  it('refuse la transition tant qu’une condition n’est pas remplie', () => {
    const result = evaluateTransition(SNAPSHOT, item(), { targetKey: 'in_progress', facts: FACTS });
    expect(!result.ok && result.error.code).toBe('workitem.transition_condition_unmet');
  });

  it('refuse l’entrée dans un état dont la limite de travail en cours bloquante est atteinte (RG-WF-004)', () => {
    const assigned = item({ assigneeId: toEntityId('0192f7c4-5a1e-7c3b-9d2e-4b8f6a1c2d40') });
    const result = evaluateTransition(SNAPSHOT, assigned, { targetKey: 'in_progress', facts: { openChildren: 0, targetCount: 2 } });
    expect(!result.ok && result.error.code).toBe('workitem.wip_limit_reached');
  });
});

describe('rang', () => {
  it('place toujours un rang strictement entre ses deux voisins', () => {
    const rank = fc.stringMatching(/^[a-y][a-z]{0,5}$/u);
    expect(() => {
      fc.assert(
        fc.property(rank, rank, (left, right) => {
          if (left === right) return true;
          const [before, after] = left < right ? [left, right] : [right, left];
          const middle = rankBetween(before, after);
          return before < middle && middle < after;
        }),
      );
    }).not.toThrow();
  });

  it('produit un rang avant le premier et après le dernier', () => {
    expect(rankBetween(null, 'm') < 'm').toBe(true);
    expect(rankBetween('m', null) > 'm').toBe(true);
  });
});
