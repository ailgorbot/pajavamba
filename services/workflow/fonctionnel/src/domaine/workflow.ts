/**
 * Workflows versionnés : états catégorisés, transitions, conditions déclaratives, publication.
 *
 * Couche : basse (workflow/fonctionnel). Règles : RG-WF-001 (version publiée immuable),
 * RG-WF-002 (catégories), RG-WF-005 (validation requise), RI-COD-16 (conditions déclaratives,
 * aucun code arbitraire), RI-MET-05, §3.5.
 */
import { domainError, err, ok, type DomainError, type Result } from '@pajavamba/kernel';

/** Catégorie d'un état (RG-WF-002). */
export type StateCategory = 'todo' | 'in_progress' | 'done';

/** État d'un workflow. */
export interface WorkflowState {
  readonly key: string;
  readonly name: string;
  readonly category: StateCategory;
  readonly wipLimit: number | null;
  readonly wipBlocking: boolean;
}

/** Condition déclarative d'une transition. */
export type TransitionCondition =
  | { readonly kind: 'field_set'; readonly field: 'assignee' | 'estimate' | 'description' | 'acceptance_criteria' }
  | { readonly kind: 'children_done' };

/** Transition ; `from` nul = depuis tout état. */
export interface WorkflowTransition {
  readonly key: string;
  readonly name: string;
  readonly from: string | null;
  readonly to: string;
  readonly conditions: readonly TransitionCondition[];
  readonly requiresApproval: boolean;
}

/** Définition d'une version de workflow. */
export interface WorkflowDefinition {
  readonly states: readonly WorkflowState[];
  readonly transitions: readonly WorkflowTransition[];
}

/** Statut d'une version. */
export type VersionStatus = 'draft' | 'published' | 'retired';

/** Version d'un workflow. */
export interface WorkflowVersion {
  readonly id: string;
  readonly workflowId: string;
  readonly number: number;
  readonly status: VersionStatus;
  readonly definition: WorkflowDefinition;
  readonly publishedAt: number | null;
}

/** Workflow d'un projet. */
export interface Workflow {
  readonly id: string;
  readonly projectId: string;
  readonly key: string;
  readonly name: string;
}

const KEY_PATTERN = /^[a-z][a-z0-9_]{1,40}$/u;
const NAME_MAX = 80;
const MAX_STATES = 30;

/**
 * Erreur de définition invalide.
 * @param message détail
 * @returns erreur
 */
function invalid(message: string): DomainError {
  return domainError('workflow.invalid_definition', 'validation', message);
}

/**
 * Vérifie l'unicité et la forme des clés d'une liste.
 * @param keys clés
 * @returns vrai si toutes sont valides et uniques
 */
function validKeys(keys: readonly string[]): boolean {
  return new Set(keys).size === keys.length && keys.every((key) => KEY_PATTERN.test(key));
}

/**
 * Valide une définition de workflow : états, catégories, transitions cohérentes.
 * @param definition définition proposée
 * @returns définition ou erreur
 */
export function validateDefinition(definition: WorkflowDefinition): Result<WorkflowDefinition, DomainError> {
  const stateKeys = definition.states.map((state) => state.key);
  if (definition.states.length === 0 || definition.states.length > MAX_STATES) return err(invalid('Un workflow compte entre 1 et 30 états.'));
  if (!validKeys(stateKeys)) return err(invalid('Les clés des états doivent être uniques et au format a-z, 0-9, « _ ».'));
  if (definition.states.some((state) => state.name.trim().length === 0 || state.name.length > NAME_MAX)) return err(invalid('Chaque état a un nom de 1 à 80 caractères.'));
  if (!definition.states.some((state) => state.category === 'todo') || !definition.states.some((state) => state.category === 'done')) return err(invalid('Un workflow comprend au moins un état « à faire » et un état « terminé ».'));
  if (!validKeys(definition.transitions.map((transition) => transition.key))) return err(invalid('Les clés des transitions doivent être uniques.'));
  const known = new Set(stateKeys);
  const dangling = definition.transitions.some((transition) => !known.has(transition.to) || (transition.from !== null && !known.has(transition.from)));
  return dangling ? err(invalid('Une transition référence un état inexistant.')) : ok(definition);
}

/**
 * Publie une version brouillon ; une version publiée n'est plus jamais modifiée (RG-WF-001).
 * @param version version brouillon
 * @param now instant courant
 * @returns version publiée ou erreur
 */
export function publish(version: WorkflowVersion, now: number): Result<WorkflowVersion, DomainError> {
  if (version.status !== 'draft') return err(domainError('workflow.version_immutable', 'conflict', 'Seule une version brouillon peut être publiée ; une version publiée est immuable.'));
  const valid = validateDefinition(version.definition);
  return valid.ok ? ok({ ...version, status: 'published', publishedAt: now }) : valid;
}

/**
 * Transitions possibles depuis un état.
 * @param definition définition
 * @param from état courant
 * @returns transitions applicables
 */
export function transitionsFrom(definition: WorkflowDefinition, from: string): readonly WorkflowTransition[] {
  return definition.transitions.filter((transition) => (transition.from === null || transition.from === from) && transition.to !== from);
}

/**
 * Valide la clé d'un workflow.
 * @param key clé proposée
 * @returns clé ou erreur
 */
export function validateWorkflowKey(key: string): Result<string, DomainError> {
  return KEY_PATTERN.test(key) ? ok(key) : err(domainError('workflow.invalid_key', 'validation', 'La clé du workflow doit être au format a-z, 0-9, « _ » (2 à 41 caractères).'));
}
