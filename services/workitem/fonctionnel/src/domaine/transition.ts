/**
 * Évaluation d'une transition selon la version de workflow rattachée à l'élément.
 *
 * Couche : basse (workitem/fonctionnel). Règles : RG-WI-005 (transition de la version rattachée),
 * RG-WF-004 (limite WIP bloquante), RG-WF-005 (validation humaine requise), RI-COD-16.
 */
import { domainError, err, ok, type DomainError, type Result } from '@pajavamba/kernel';
import type { StateCategory, WorkItem } from './work-item.ts';

/** État d'une version de workflow (instantané immuable). */
export interface SnapshotState {
  readonly key: string;
  readonly name: string;
  readonly category: StateCategory;
  readonly wipLimit: number | null;
  readonly wipBlocking: boolean;
}

/** Condition déclarative. */
export type SnapshotCondition =
  | { readonly kind: 'field_set'; readonly field: 'assignee' | 'estimate' | 'description' | 'acceptance_criteria' }
  | { readonly kind: 'children_done' };

/** Transition d'une version. */
export interface SnapshotTransition {
  readonly key: string;
  readonly name: string;
  readonly from: string | null;
  readonly to: string;
  readonly conditions: readonly SnapshotCondition[];
  readonly requiresApproval: boolean;
}

/** Version publiée d'un workflow, copiée localement (immuable, RG-WF-001). */
export interface WorkflowSnapshot {
  readonly versionId: string;
  readonly workflowKey: string;
  readonly number: number;
  readonly states: readonly SnapshotState[];
  readonly transitions: readonly SnapshotTransition[];
}

/** Faits nécessaires à l'évaluation des conditions. */
export interface TransitionFacts {
  readonly openChildren: number;
  /** Nombre d'éléments dans l'état cible (limite WIP). */
  readonly targetCount: number;
}

const NOT_ALLOWED = (from: string, to: string): DomainError => domainError('workitem.transition_not_allowed', 'conflict', `La transition vers « ${to} » n'est pas possible depuis l'état « ${from} ».`);
const APPROVAL_REQUIRED = domainError('workitem.approval_required', 'conflict', 'Cette transition exige une validation humaine, disponible avec le service de validation (lot 5).');

/**
 * Premier état « à faire » : état initial d'un nouvel élément.
 * @param snapshot version de workflow
 * @returns état initial
 */
export function initialState(snapshot: WorkflowSnapshot): SnapshotState | undefined {
  return snapshot.states.find((state) => state.category === 'todo') ?? snapshot.states[0];
}

/**
 * Message d'une condition non remplie, ou `undefined` si elle l'est.
 * @param condition condition
 * @param item élément
 * @param facts faits
 * @returns message ou `undefined`
 */
function unmet(condition: SnapshotCondition, item: WorkItem, facts: TransitionFacts): string | undefined {
  if (condition.kind === 'children_done') return facts.openChildren > 0 ? 'Tous les sous-éléments doivent être terminés.' : undefined;
  const filled: Readonly<Record<typeof condition.field, boolean>> = {
    assignee: item.assigneeId !== null,
    estimate: item.estimate !== null,
    description: item.description.trim() !== '',
    acceptance_criteria: item.acceptanceCriteria.trim() !== '',
  };
  return filled[condition.field] ? undefined : `Le champ « ${condition.field} » doit être renseigné.`;
}

/**
 * Évalue le passage d'un élément vers un état cible.
 * @param snapshot version rattachée à l'élément
 * @param item élément
 * @param targetKey état cible
 * @param facts faits utiles aux conditions
 * @returns état cible ou erreur
 */
export function evaluateTransition(snapshot: WorkflowSnapshot, item: WorkItem, targetKey: string, facts: TransitionFacts): Result<SnapshotState, DomainError> {
  const target = snapshot.states.find((state) => state.key === targetKey);
  const current = snapshot.states.find((state) => state.key === item.stateKey);
  const transition = snapshot.transitions.find((candidate) => candidate.to === targetKey && (candidate.from === null || candidate.from === item.stateKey));
  if (target === undefined || transition === undefined || targetKey === item.stateKey) return err(NOT_ALLOWED(current?.name ?? item.stateKey, target?.name ?? targetKey));
  if (transition.requiresApproval) return err(APPROVAL_REQUIRED);
  const failure = transition.conditions.map((condition) => unmet(condition, item, facts)).find((message) => message !== undefined);
  if (failure !== undefined) return err(domainError('workitem.transition_condition_unmet', 'conflict', failure));
  if (target.wipBlocking && target.wipLimit !== null && facts.targetCount >= target.wipLimit) {
    return err(domainError('workitem.wip_limit_reached', 'conflict', `La limite de travail en cours de « ${target.name} » (${String(target.wipLimit)}) est atteinte.`));
  }
  return ok(target);
}
