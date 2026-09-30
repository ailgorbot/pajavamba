/**
 * Agrégat Élément de travail et ses règles de saisie.
 *
 * Couche : basse (workitem/fonctionnel). Règles : RG-WI-001 (clé `<projet>-<n>`), RG-WI-007
 * (confidentialité), RG-WI-008 (corbeille), §6.5.3.
 */
import { domainError, err, ok, type DomainError, type ProjectId, type Result, type UserId } from '@pajavamba/kernel';

/** Catégorie d'état. */
export type StateCategory = 'todo' | 'in_progress' | 'done';

/** Priorités disponibles. */
export const PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest'] as const;

/** Priorité d'un élément. */
export type Priority = (typeof PRIORITIES)[number];

/** Confidentialité d'un élément. */
export type Confidentiality = 'normal' | 'restricted';

/** Canal de création. */
export type CreatedVia = 'ui' | 'api' | 'mcp' | 'import' | 'plugin' | 'automation';

/** Élément de travail. */
export interface WorkItem {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly number: number;
  readonly key: string;
  readonly typeKey: string;
  readonly title: string;
  readonly description: string;
  readonly acceptanceCriteria: string;
  readonly stateKey: string;
  readonly stateCategory: StateCategory;
  readonly workflowVersionId: string;
  readonly priority: Priority;
  readonly parentId: string | null;
  /** Chemin des ancêtres (identifiants), racine en premier. */
  readonly ancestors: readonly string[];
  readonly assigneeId: UserId | null;
  readonly reporterId: UserId | null;
  readonly estimate: number | null;
  readonly rank: string;
  readonly confidentiality: Confidentiality;
  readonly createdVia: CreatedVia;
  readonly createdAt: number;
  readonly resolvedAt: number | null;
  readonly deletedAt: number | null;
  readonly version: number;
}

const TITLE_MAX = 255;
const DESCRIPTION_MAX = 65_535;
const CRITERIA_MAX = 20_000;
const ESTIMATE_MAX = 9_999;

/**
 * Valide un titre (1 à 255 caractères).
 * @param title titre
 * @returns titre normalisé ou erreur
 */
export function validateTitle(title: string): Result<string, DomainError> {
  const trimmed = title.trim();
  return trimmed.length > 0 && trimmed.length <= TITLE_MAX ? ok(trimmed) : err(domainError('workitem.invalid_title', 'validation', 'Le titre doit contenir entre 1 et 255 caractères.'));
}

/**
 * Valide un texte long (description ou critères d'acceptation).
 * @param text texte
 * @param kind nature du texte
 * @returns texte ou erreur
 */
export function validateLongText(text: string, kind: 'description' | 'criteria'): Result<string, DomainError> {
  const max = kind === 'description' ? DESCRIPTION_MAX : CRITERIA_MAX;
  return text.length <= max ? ok(text) : err(domainError('workitem.text_too_long', 'validation', `Le texte ne doit pas dépasser ${String(max)} caractères.`));
}

/**
 * Valide une estimation (positive, bornée).
 * @param estimate estimation ou `null`
 * @returns estimation ou erreur
 */
export function validateEstimate(estimate: number | null): Result<number | null, DomainError> {
  if (estimate === null) return ok(null);
  return Number.isFinite(estimate) && estimate >= 0 && estimate <= ESTIMATE_MAX ? ok(Math.round(estimate * 100) / 100) : err(domainError('workitem.invalid_estimate', 'validation', "L'estimation doit être comprise entre 0 et 9 999."));
}

/**
 * Construit la clé d'un élément (RG-WI-001).
 * @param projectKey clé du projet
 * @param itemNumber numéro séquentiel
 * @returns clé
 */
export function itemKey(projectKey: string, itemNumber: number): string {
  return `${projectKey}-${String(itemNumber)}`;
}

/** Erreur d'élément introuvable ou inaccessible. */
export const ITEM_NOT_FOUND = domainError('workitem.not_found', 'not_found', "Cet élément n'existe pas ou n'est pas accessible.");
