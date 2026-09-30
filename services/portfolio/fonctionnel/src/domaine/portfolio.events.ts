/**
 * Événements du domaine portfolio.
 *
 * Couche : basse (portfolio/fonctionnel). Règles : RI-NOM-07, §5.7.
 */
import type { DomainEvent, EventValue } from '@pajavamba/kernel';
import type { Project } from './project.ts';

/** Types d'événements publiés par portfolio. */
export const PORTFOLIO_EVENTS = {
  projectCreated: 'pv.portfolio.project.created.v1',
  projectUpdated: 'pv.portfolio.project.updated.v1',
  projectActivated: 'pv.portfolio.project.activated.v1',
  projectClosed: 'pv.portfolio.project.closed.v1',
  projectReopened: 'pv.portfolio.project.reopened.v1',
  projectArchived: 'pv.portfolio.project.archived.v1',
  projectUnarchived: 'pv.portfolio.project.unarchived.v1',
  projectDeletionScheduled: 'pv.portfolio.project.deletion_scheduled.v1',
  projectDeletionCancelled: 'pv.portfolio.project.deletion_cancelled.v1',
  projectPurged: 'pv.portfolio.project.purged.v1',
  teamCreated: 'pv.portfolio.team.created.v1',
  teamUpdated: 'pv.portfolio.team.updated.v1',
  teamMemberAdded: 'pv.portfolio.team.member_added.v1',
  teamMemberRemoved: 'pv.portfolio.team.member_removed.v1',
} as const;

/**
 * Événement de projet : identifiants et statut ; nom et clé pour les vues de lecture internes.
 * @param type type d'événement
 * @param project projet après changement
 * @param extra données complémentaires
 * @returns événement
 */
export function projectEvent(type: string, project: Project, extra: Readonly<Record<string, EventValue>> = {}): DomainEvent {
  return { type, aggregateId: project.id, aggregateVersion: project.version, data: { key: project.key, name: project.name, status: project.status, methodologyPackKey: project.methodologyPackKey, ...extra } };
}
