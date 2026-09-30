/**
 * Équipes, appartenances et rattachement aux projets.
 *
 * Couche : basse (portfolio/fonctionnel). Référence : §6.5.2 (`teams`, `team_memberships`).
 */
import { domainError, err, ok, type DomainError, type OrganisationId, type Result, type UserId } from '@pajavamba/kernel';

/** Nature d'une équipe. */
export type TeamKind = 'scrum' | 'kanban' | 'scrumban' | 'other';

/** Rôle au sein d'une équipe. */
export type TeamRole = 'member' | 'scrum_master' | 'product_owner' | 'other';

/** Équipe. */
export interface Team {
  readonly id: string;
  readonly organisationId: OrganisationId;
  readonly key: string;
  readonly name: string;
  readonly kind: TeamKind;
  readonly timeZone: string;
  readonly workingDays: readonly number[];
  readonly version: number;
}

/** Appartenance à une équipe. */
export interface TeamMembership {
  readonly teamId: string;
  readonly userId: UserId;
  readonly teamRole: TeamRole;
  readonly allocationPercent: number;
}

const TEAM_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,5}$/u;
const MIN_DAY = 1;
const MAX_DAY = 7;
const MAX_ALLOCATION = 100;

/**
 * Valide la clé d'une équipe (§6.3).
 * @param key clé proposée
 * @returns clé ou erreur
 */
export function validateTeamKey(key: string): Result<string, DomainError> {
  return TEAM_KEY_PATTERN.test(key) ? ok(key) : err(domainError('portfolio.invalid_team_key', 'validation', "La clé d'équipe doit commencer par une majuscule et contenir 2 à 6 caractères parmi A-Z et 0-9."));
}

/**
 * Valide les jours travaillés (1 = lundi … 7 = dimanche).
 * @param days jours proposés
 * @returns jours triés sans doublon ou erreur
 */
export function validateWorkingDays(days: readonly number[]): Result<readonly number[], DomainError> {
  const valid = days.length > 0 && days.every((day) => Number.isInteger(day) && day >= MIN_DAY && day <= MAX_DAY);
  return valid ? ok([...new Set(days)].sort((left, right) => left - right)) : err(domainError('portfolio.invalid_working_days', 'validation', 'Les jours travaillés doivent être compris entre 1 (lundi) et 7 (dimanche).'));
}

/**
 * Valide une allocation (1 à 100 %).
 * @param allocation pourcentage
 * @returns allocation ou erreur
 */
export function validateAllocation(allocation: number): Result<number, DomainError> {
  return Number.isInteger(allocation) && allocation >= 1 && allocation <= MAX_ALLOCATION ? ok(allocation) : err(domainError('portfolio.invalid_allocation', 'validation', "L'allocation doit être comprise entre 1 et 100 %."));
}
