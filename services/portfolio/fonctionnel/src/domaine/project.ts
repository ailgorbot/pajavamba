/**
 * Agrégat Projet et son cycle de vie (§2.4).
 *
 * Couche : basse (portfolio/fonctionnel). Règles : RG-PRJ-001 (clé), RG-PRJ-003 (transitions),
 * RG-PRJ-004 (lecture seule), RG-PRJ-005 (conditions de clôture), RG-PRJ-006 (réouverture sous
 * 90 jours), RG-PRJ-007 (délais de grâce), RI-MET-01, RI-MET-02.
 */
import { domainError, err, ok, type DomainError, type OrganisationId, type ProjectId, type Result, type UserId } from '@pajavamba/kernel';

/** Statut du cycle de vie. */
export type ProjectStatus = 'draft' | 'active' | 'closed' | 'archived' | 'pending_deletion';

/** Visibilité d'un projet. */
export type ProjectVisibility = 'private' | 'internal' | 'public';

/** Modèles méthodologiques disponibles. */
export const METHODOLOGY_PACKS = ['scrum', 'kanban', 'scrumban', 'custom'] as const;

/** Clé de modèle méthodologique. */
export type MethodologyPackKey = (typeof METHODOLOGY_PACKS)[number];

/** Projet. */
export interface Project {
  readonly id: ProjectId;
  readonly organisationId: OrganisationId;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly status: ProjectStatus;
  readonly visibility: ProjectVisibility;
  readonly methodologyPackKey: MethodologyPackKey;
  readonly timeZone: string;
  readonly configurationReady: boolean;
  readonly openItemCount: number;
  readonly createdBy: UserId | null;
  readonly closedAt: number | null;
  readonly closureSummary: string | null;
  readonly archivedAt: number | null;
  readonly deletionScheduledFor: number | null;
  readonly deletionFromStatus: ProjectStatus | null;
  readonly version: number;
}

const KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/u;
const NAME_MAX = 120;
const TEXT_MAX = 10_000;
const DAY_MS = 86_400_000;
/** Délai de réouverture (RG-PRJ-006) : 90 jours. */
export const REOPEN_WINDOW_MS = 90 * DAY_MS;
/** Délai de grâce avant purge (RG-PRJ-007) : 30 jours. */
export const DELETION_GRACE_MS = 30 * DAY_MS;
/** Délai de grâce d'un brouillon : 7 jours. */
export const DRAFT_DELETION_GRACE_MS = 7 * DAY_MS;

/**
 * Erreur de transition interdite (RG-PRJ-003).
 * @param action transition demandée
 * @param status statut courant
 * @returns erreur
 */
function forbiddenTransition(action: string, status: ProjectStatus): DomainError {
  return domainError('portfolio.transition_not_allowed', 'conflict', `L'action « ${action} » n'est pas possible pour un projet au statut « ${STATUS_LABELS[status]} ».`);
}

/** Libellés français des statuts. */
export const STATUS_LABELS: Readonly<Record<ProjectStatus, string>> = { draft: 'brouillon', active: 'actif', closed: 'clôturé', archived: 'archivé', pending_deletion: 'suppression programmée' };

/**
 * Valide la clé d'un projet (RG-PRJ-001).
 * @param key clé proposée
 * @returns clé ou erreur
 */
export function validateProjectKey(key: string): Result<string, DomainError> {
  return KEY_PATTERN.test(key) ? ok(key) : err(domainError('portfolio.invalid_key', 'validation', 'La clé doit commencer par une majuscule et contenir 2 à 10 caractères parmi A-Z et 0-9.'));
}

/**
 * Valide le nom d'un projet.
 * @param name nom proposé
 * @returns nom normalisé ou erreur
 */
export function validateProjectName(name: string): Result<string, DomainError> {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= NAME_MAX ? ok(trimmed) : err(domainError('portfolio.invalid_name', 'validation', 'Le nom doit contenir entre 1 et 120 caractères.'));
}

/**
 * Valide un texte libre borné (description, bilan, justification).
 * @param text texte
 * @param required vrai si le texte est obligatoire
 * @returns texte normalisé ou erreur
 */
export function validateText(text: string, required: boolean): Result<string, DomainError> {
  const trimmed = text.trim();
  if (required && trimmed.length === 0) return err(domainError('portfolio.text_required', 'validation', 'Ce texte est obligatoire.'));
  return trimmed.length <= TEXT_MAX ? ok(trimmed) : err(domainError('portfolio.text_too_long', 'validation', 'Le texte ne doit pas dépasser 10 000 caractères.'));
}

/**
 * Indique si le projet est en lecture seule (RG-PRJ-004).
 * @param project projet
 * @returns vrai si aucune modification n'est permise
 */
export function isReadOnly(project: Project): boolean {
  return project.status === 'closed' || project.status === 'archived' || project.status === 'pending_deletion';
}

/** Erreur de projet en lecture seule. */
export const READ_ONLY = domainError('portfolio.project_read_only', 'conflict', 'Ce projet est clôturé, archivé ou en suppression programmée : il est en lecture seule.');

/**
 * Applique une transition si le statut courant la permet.
 * @param project projet
 * @param request libellé de l'action, statuts d'origine admis et modifications
 * @returns projet modifié ou erreur
 */
export function transition(project: Project, request: { readonly action: string; readonly from: readonly ProjectStatus[]; readonly change: Partial<Project> }): Result<Project, DomainError> {
  if (!request.from.includes(project.status)) return err(forbiddenTransition(request.action, project.status));
  return ok({ ...project, ...request.change, version: project.version + 1 });
}

/** Point bloquant de la clôture (assistant de clôture). */
export interface ClosureBlocker {
  readonly code: string;
  readonly message: string;
}

/**
 * Liste les points bloquants de la clôture (RG-PRJ-005) ; les dépendances, risques, itérations et
 * validations relèvent de services livrés aux lots 4 à 8 et sont sans objet dans le MVP.
 * @param project projet
 * @returns points bloquants
 */
export function closureBlockers(project: Project): ClosureBlocker[] {
  const blockers: ClosureBlocker[] = [];
  if (project.status !== 'active') blockers.push({ code: 'not_active', message: 'Seul un projet actif peut être clôturé.' });
  if (project.openItemCount > 0) blockers.push({ code: 'open_items', message: `${String(project.openItemCount)} élément(s) ne sont ni terminés ni annulés.` });
  return blockers;
}

/**
 * Indique si la réouverture est encore possible (RG-PRJ-006).
 * @param project projet clôturé
 * @param now instant courant
 * @returns vrai si le délai n'est pas échu
 */
export function canReopen(project: Project, now: number): boolean {
  return project.closedAt !== null && now - project.closedAt <= REOPEN_WINDOW_MS;
}
