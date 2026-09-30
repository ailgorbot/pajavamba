/**
 * Cas d'usage du cycle de vie d'un projet : activer, clôturer, rouvrir, archiver, désarchiver,
 * programmer et annuler la suppression, purger.
 *
 * Couche : basse (portfolio/fonctionnel). Règles : RG-PRJ-003 à RG-PRJ-007, RI-MET-01 (aucune
 * clôture forcée), RI-MET-03.
 */
import { domainError, err, ok, type DomainError, type DomainEvent, type ExecutionContext, type Result, type UseCaseOutput } from '@pajavamba/kernel';
import { PORTFOLIO_EVENTS, projectEvent } from '../domaine/portfolio.events.ts';
import { canReopen, closureBlockers, DELETION_GRACE_MS, DRAFT_DELETION_GRACE_MS, transition, validateText, type Project } from '../domaine/project.ts';
import type { PortfolioDependencies } from '../ports/portfolio.ports.ts';
import { loadProject, type ProjectAccess, type ProjectRef } from './project-access.ts';

/** Transition du cycle de vie. */
export type LifecycleAction = 'activate' | 'close' | 'reopen' | 'archive' | 'unarchive' | 'request_deletion' | 'cancel_deletion';

/** Entrée d'une transition. */
export interface LifecycleInput {
  readonly action: LifecycleAction;
  /** Bilan de clôture ou justification de réouverture. */
  readonly text: string;
}

const ACCESS: Readonly<Record<LifecycleAction, ProjectAccess>> = {
  activate: { permission: 'project:activate', risk: 'R1', writable: false },
  close: { permission: 'project:close', risk: 'R2', writable: false },
  reopen: { permission: 'project:reopen', risk: 'R2', writable: false },
  archive: { permission: 'project:archive', risk: 'R2', writable: false },
  unarchive: { permission: 'project:unarchive', risk: 'R3', writable: false },
  request_deletion: { permission: 'project:delete', risk: 'R3', writable: false },
  cancel_deletion: { permission: 'project:delete', risk: 'R3', writable: false },
};

const NOT_CONFIGURED = domainError('portfolio.configuration_pending', 'conflict', "La configuration du modèle méthodologique (types et workflows publiés) n'est pas encore prête. Réessayez dans quelques instants.");
const REOPEN_EXPIRED = domainError('portfolio.reopen_window_expired', 'conflict', 'Le délai de réouverture de 90 jours est dépassé.');

/**
 * Calcule le projet après transition.
 * @param project projet courant
 * @param input transition demandée
 * @param now instant courant
 * @returns projet modifié ou erreur
 */
function applyTransition(project: Project, input: LifecycleInput, now: number): Result<Project, DomainError> {
  switch (input.action) {
    case 'activate':
      return project.configurationReady ? transition(project, 'activer', ['draft'], { status: 'active' }) : err(NOT_CONFIGURED);
    case 'close': {
      const blocker = closureBlockers(project)[0];
      if (blocker !== undefined) return err(domainError(`portfolio.closure_blocked.${blocker.code}`, 'conflict', blocker.message));
      const summary = validateText(input.text, true);
      return summary.ok ? transition(project, 'clôturer', ['active'], { status: 'closed', closedAt: now, closureSummary: summary.value }) : summary;
    }
    case 'reopen': {
      const justification = validateText(input.text, true);
      if (!justification.ok) return justification;
      return project.status === 'closed' && !canReopen(project, now) ? err(REOPEN_EXPIRED) : transition(project, 'rouvrir', ['closed'], { status: 'active', closedAt: null });
    }
    case 'archive':
      return transition(project, 'archiver', ['closed'], { status: 'archived', archivedAt: now });
    case 'unarchive':
      return transition(project, 'désarchiver', ['archived'], { status: 'closed', archivedAt: null });
    case 'request_deletion': {
      const grace = project.status === 'draft' ? DRAFT_DELETION_GRACE_MS : DELETION_GRACE_MS;
      return transition(project, 'supprimer', ['draft', 'archived'], { status: 'pending_deletion', deletionScheduledFor: now + grace, deletionFromStatus: project.status });
    }
    case 'cancel_deletion':
      return transition(project, 'annuler la suppression', ['pending_deletion'], { status: project.deletionFromStatus ?? 'archived', deletionScheduledFor: null, deletionFromStatus: null });
  }
}

const EVENT_BY_ACTION: Readonly<Record<LifecycleAction, string>> = {
  activate: PORTFOLIO_EVENTS.projectActivated,
  close: PORTFOLIO_EVENTS.projectClosed,
  reopen: PORTFOLIO_EVENTS.projectReopened,
  archive: PORTFOLIO_EVENTS.projectArchived,
  unarchive: PORTFOLIO_EVENTS.projectUnarchived,
  request_deletion: PORTFOLIO_EVENTS.projectDeletionScheduled,
  cancel_deletion: PORTFOLIO_EVENTS.projectDeletionCancelled,
};

/**
 * Applique une transition du cycle de vie (`project.<action>`).
 * @param dependencies dépendances
 * @param context contexte
 * @param ref projet
 * @param input transition et texte associé
 * @returns projet modifié
 */
export async function changeLifecycle(dependencies: PortfolioDependencies, context: ExecutionContext, ref: ProjectRef, input: LifecycleInput): Promise<Result<UseCaseOutput<Project>, DomainError>> {
  const loaded = await loadProject(dependencies, context, ref, ACCESS[input.action]);
  if (!loaded.ok) return loaded;
  const changed = applyTransition(loaded.value, input, dependencies.clock.now());
  if (!changed.ok) return changed;
  await dependencies.projects.update(changed.value);
  return ok({ result: changed.value, events: [projectEvent(EVENT_BY_ACTION[input.action], changed.value)] });
}

/**
 * Purge les projets dont le délai de grâce est échu (tâche système, RG-PRJ-007).
 * @param dependencies dépendances
 * @returns événements de purge
 */
export async function purgeDueProjects(dependencies: PortfolioDependencies): Promise<readonly DomainEvent[]> {
  const due = await dependencies.projects.listDueForPurge(dependencies.clock.now());
  const events: DomainEvent[] = [];
  for (const project of due) {
    await dependencies.projects.delete(project.id);
    events.push({ type: PORTFOLIO_EVENTS.projectPurged, aggregateId: project.id, aggregateVersion: project.version + 1, data: { key: project.key } });
  }
  return events;
}
