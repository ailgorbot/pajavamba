/**
 * Tests des workflows : définitions valides, catégories d'états, immutabilité des versions publiées, packs livrés.
 *
 * Couche : basse (workflow). Règles vérifiées : RG-WF-001, RG-WF-002.
 */
import { describe, expect, it } from 'vitest';
import { METHODOLOGY_PACK_CATALOG, publish, transitionsFrom, validateDefinition, validateWorkflowKey, type WorkflowDefinition, type WorkflowVersion } from '../src/index.ts';

const DEFINITION: WorkflowDefinition = {
  states: [
    { key: 'todo', name: 'À faire', category: 'todo', wipLimit: null, wipBlocking: false },
    { key: 'doing', name: 'En cours', category: 'in_progress', wipLimit: 3, wipBlocking: false },
    { key: 'done', name: 'Terminé', category: 'done', wipLimit: null, wipBlocking: false },
  ],
  transitions: [
    { key: 'start', name: 'Démarrer', from: 'todo', to: 'doing', conditions: [], requiresApproval: false },
    { key: 'finish', name: 'Terminer', from: 'doing', to: 'done', conditions: [], requiresApproval: false },
    { key: 'cancel', name: 'Annuler', from: null, to: 'done', conditions: [], requiresApproval: false },
  ],
};

const TODO_STATE = { key: 'todo', name: 'À faire', category: 'todo', wipLimit: null, wipBlocking: false } as const;

const DRAFT: WorkflowVersion = { id: 'version-1', workflowId: 'workflow-1', number: 1, status: 'draft', definition: DEFINITION, publishedAt: null };

describe('définition de workflow (RG-WF-002)', () => {
  it('accepte une définition complète', () => {
    expect(validateDefinition(DEFINITION).ok).toBe(true);
  });

  it('exige au moins un état « à faire » et un état « terminé »', () => {
    const withoutDone = { ...DEFINITION, states: DEFINITION.states.filter((state) => state.category !== 'done'), transitions: [] };
    expect(validateDefinition(withoutDone).ok).toBe(false);
  });

  it('refuse des clés d’états en double et une transition vers un état inexistant', () => {
    expect(validateDefinition({ ...DEFINITION, states: [...DEFINITION.states, TODO_STATE] }).ok).toBe(false);
    expect(validateDefinition({ ...DEFINITION, transitions: [{ key: 'ghost', name: 'Fantôme', from: 'todo', to: 'absent', conditions: [], requiresApproval: false }] }).ok).toBe(false);
  });

  it('propose les transitions depuis un état, y compris celles valables depuis tout état', () => {
    expect(transitionsFrom(DEFINITION, 'todo').map((transition) => transition.key)).toEqual(['start', 'cancel']);
    expect(transitionsFrom(DEFINITION, 'done').map((transition) => transition.key)).toEqual([]);
  });
});

describe('versions publiées (RG-WF-001)', () => {
  it('publie une version brouillon valide', () => {
    const result = publish(DRAFT, 1_000);
    expect(result.ok && result.value).toMatchObject({ status: 'published', publishedAt: 1_000 });
  });

  it('refuse de republier ou de modifier une version publiée', () => {
    const result = publish({ ...DRAFT, status: 'published', publishedAt: 1_000 }, 2_000);
    expect(!result.ok && result.error.code).toBe('workflow.version_immutable');
  });
});

describe('packs méthodologiques livrés', () => {
  it('ne livre que des workflows valides, dont chaque état a une catégorie (RG-WF-002)', () => {
    const workflows = METHODOLOGY_PACK_CATALOG.flatMap((pack) => pack.workflows);
    expect(workflows.length).toBeGreaterThan(0);
    for (const workflow of workflows) {
      expect(validateWorkflowKey(workflow.key).ok).toBe(true);
      expect(validateDefinition(workflow.definition).ok).toBe(true);
    }
  });

  it('propose Scrum, Kanban, Scrumban et Personnalisé', () => {
    expect(METHODOLOGY_PACK_CATALOG.map((pack) => pack.key).sort((left, right) => left.localeCompare(right))).toEqual(['custom', 'kanban', 'scrum', 'scrumban']);
  });
});
