/**
 * Packs méthodologiques fournis : types d'éléments, hiérarchie et workflows par défaut (§3.3).
 *
 * Couche : basse (workflow/fonctionnel). Règles : RI-MET-04 (configuration déclarative, jamais
 * figée dans le code métier : le pack n'est que la valeur initiale copiée dans le projet), §3.3.
 */
import type { StateCategory, WorkflowDefinition, WorkflowState } from './workflow.ts';

/** Type d'élément défini par un pack. */
export interface PackItemType {
  readonly key: string;
  readonly name: string;
  readonly level: number;
  readonly allowedParentKeys: readonly string[];
  readonly workflowKey: string;
}

/** Workflow défini par un pack. */
export interface PackWorkflow {
  readonly key: string;
  readonly name: string;
  readonly definition: WorkflowDefinition;
}

/** Pack méthodologique. */
export interface MethodologyPack {
  readonly key: string;
  readonly version: number;
  readonly name: string;
  readonly types: readonly PackItemType[];
  readonly workflows: readonly PackWorkflow[];
  /** Sprints proposés par le pack. */
  readonly iterations: boolean;
}

type StateSpec = readonly [key: string, name: string, category: StateCategory];

/**
 * Construit une définition où chaque état est atteignable depuis tout état (workflow simple).
 * @param specs états
 * @returns définition
 */
function openWorkflow(specs: readonly StateSpec[]): WorkflowDefinition {
  const states: WorkflowState[] = specs.map(([key, name, category]) => ({ key, name, category, wipLimit: null, wipBlocking: false }));
  return {
    states,
    transitions: states.map((state) => ({ key: `to_${state.key}`, name: `Passer à « ${state.name} »`, from: null, to: state.key, conditions: [], requiresApproval: false })),
  };
}

const TEAM_WORKFLOW: PackWorkflow = {
  key: 'team_item',
  name: "Éléments d'équipe",
  definition: openWorkflow([
    ['backlog', 'Backlog', 'todo'],
    ['ready', 'Prêt', 'todo'],
    ['in_progress', 'En cours', 'in_progress'],
    ['in_review', 'En revue', 'in_progress'],
    ['in_validation', 'En validation', 'in_progress'],
    ['done', 'Terminé', 'done'],
    ['cancelled', 'Annulé', 'done'],
  ]),
};

const EPIC_WORKFLOW: PackWorkflow = {
  key: 'epic',
  name: 'Epic',
  definition: openWorkflow([
    ['idea', 'Idée', 'todo'],
    ['analysis', 'Analyse', 'todo'],
    ['portfolio_review', 'Revue portefeuille', 'todo'],
    ['approved', 'Approuvé', 'todo'],
    ['implementation', 'Réalisation', 'in_progress'],
    ['done', 'Terminé', 'done'],
    ['cancelled', 'Annulé', 'done'],
  ]),
};

const BUG_WORKFLOW: PackWorkflow = {
  key: 'bug',
  name: 'Anomalie',
  definition: openWorkflow([
    ['new', 'Nouveau', 'todo'],
    ['qualified', 'Qualifié', 'todo'],
    ['in_progress', 'En cours', 'in_progress'],
    ['in_review', 'En revue', 'in_progress'],
    ['resolved', 'Résolu', 'done'],
    ['closed', 'Clos', 'done'],
    ['rejected', 'Rejeté', 'done'],
  ]),
};

const KANBAN_TYPES: readonly PackItemType[] = [
  { key: 'epic', name: 'Epic', level: 1, allowedParentKeys: [], workflowKey: 'epic' },
  { key: 'item', name: 'Élément', level: 2, allowedParentKeys: ['epic'], workflowKey: 'team_item' },
  { key: 'bug', name: 'Anomalie', level: 2, allowedParentKeys: ['epic'], workflowKey: 'bug' },
];

/** Packs fournis. */
export const METHODOLOGY_PACK_CATALOG: readonly MethodologyPack[] = [
  {
    key: 'scrum',
    version: 1,
    name: 'Scrum',
    iterations: true,
    workflows: [TEAM_WORKFLOW, EPIC_WORKFLOW, BUG_WORKFLOW],
    types: [
      { key: 'epic', name: 'Epic', level: 1, allowedParentKeys: [], workflowKey: 'epic' },
      { key: 'story', name: 'User story', level: 2, allowedParentKeys: ['epic'], workflowKey: 'team_item' },
      { key: 'bug', name: 'Anomalie', level: 2, allowedParentKeys: ['epic'], workflowKey: 'bug' },
      { key: 'task', name: 'Tâche', level: 3, allowedParentKeys: ['story', 'bug'], workflowKey: 'team_item' },
    ],
  },
  { key: 'kanban', version: 1, name: 'Kanban', iterations: false, workflows: [TEAM_WORKFLOW, EPIC_WORKFLOW, BUG_WORKFLOW], types: KANBAN_TYPES },
  { key: 'scrumban', version: 1, name: 'Scrumban', iterations: true, workflows: [TEAM_WORKFLOW, EPIC_WORKFLOW, BUG_WORKFLOW], types: KANBAN_TYPES },
  { key: 'custom', version: 1, name: 'Personnalisé', iterations: false, workflows: [TEAM_WORKFLOW], types: [{ key: 'item', name: 'Élément', level: 1, allowedParentKeys: ['item'], workflowKey: 'team_item' }] },
];

/**
 * Retrouve un pack par sa clé.
 * @param key clé du pack
 * @returns pack ou `undefined`
 */
export function findPack(key: string): MethodologyPack | undefined {
  return METHODOLOGY_PACK_CATALOG.find((pack) => pack.key === key);
}
