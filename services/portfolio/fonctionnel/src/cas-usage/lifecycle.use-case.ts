/**
 * Cas d'usage du cycle de vie d'un projet : activer, clôturer, rouvrir, archiver, désarchiver,
 * programmer et annuler la suppression, purger.
 *
 * Couche : basse (portfolio/fonctionnel). Règles : RG-PRJ-003 à RG-PRJ-007, RI-MET-01 (aucune
 * clôture forcée), RI-MET-03.
 */
import { domainError, err, ok, type DomainError, type DomainEvent, type ExecutionContext, type ProjectRef, type Result, type UseCaseOutput } from '@pajavamba/kernel';
import { PORTFOLIO_EVENTS, projectEvent } from '../domaine/portfolio.events.ts';
import { canReopen, closureBlockers, DELETION_GRACE_MS, DRAFT_DELETION_GRACE_MS, transition, validateText, type Project } from '../domaine/project.ts';
import type { PortfolioDependencies } from '../ports/portfolio.ports.ts';
import { loadProject, type ProjectAccess } from './project-access.ts';

/** Transition du cycle de vie. */
export type LifecycleAction = 'activate' | 'close' | 'reopen' | 'archive' | 'unarchive' | 'request_deletion' | 'cancel_deletion';

/** Entrée d'une transition. */
export interface LifecycleInput {
  readonly ref: ProjectRef;
  readonly action: LifecycleAction;
  /** Bilan de clôture ou justification de réouverture. */
  readonly text: string;
}

type Step = (project: Project, input: { readonly text: string; readonly now: number }) => Result<Project, DomainError>;

const NOT_CONFIGURED = domainError('portfolio.configuration_pending', 'conflict', "La configuration du modèle méthodologique (types et workflows publiés) n'est pas encore prête. Réessayez dans quelques instants.");
const REOPEN_EXPIRED = domainError('portfolio.reopen_window_expired', 'conflict', 'Le délai de réouverture de 90 jours est dépassé.');

const activate: Step = (project) => (project.configurationReady ? transition(project, { action: 'activer', from: ['draft'], change: { status: 'active' } }) : err(NOT_CONFIGURED));

const close: Step = (project, { text, now }) => {
  const blocker = closureBlockers(project)[0];
  if (blocker !== undefined) return err(domainError(`portfolio.closure_blocked.${blocker.code}`, 'conflict', blocker.message));
  const summary = validateText(text, true);
  return summary.ok ? transition(project, { action: 'clôturer', from: ['active'], change: { status: 'closed', closedAt: now, closureSummary: summary.value } }) : summary;
};

const reopen: Step = (project, { text, now }) => {
  const justification = validateText(text, true);
  if (!justification.ok) return justification;
  if (project.status === 'closed' && !canReopen(project, now)) return err(REOPEN_EXPIRED);
  return transition(project, { action: 'rouvrir', from: ['closed'], change: { status: 'active', closedAt: null } });
};

const requestDeletion: Step = (project, { now }) => {
  const grace = project.status === 'draft' ? DRAFT_DELETION_GRACE_MS : DELETION_GRACE_MS;
  return transition(project, { action: 'supprimer', from: ['draft', 'archived'], change: { status: 'pending_deletion', deletionScheduledFor: now + grace, deletionFromStatus: project.status } });
};

const STEPS: Readonly<Record<LifecycleAction, Step>> = {
  activate,
  close,
  reopen,
  archive: (project, { now }) => transition(project, { action: 'archiver', from: ['closed'], change: { status: 'archived', archivedAt: now } }),
  unarchive: (project) => transition(project, { action: 'désarchiver', from: ['archived'], change: { status: 'closed', archivedAt: null } }),
  request_deletion: requestDeletion,
  cancel_deletion: (project) => transition(project, { action: 'annuler la suppression', from: ['pending_deletion'], change: { status: project.deletionFromStatus ?? 'archived', deletionScheduledFor: null, deletionFromStatus: null } }),
};

const ACCESS: Readonly<Record<LifecycleAction, Omit<ProjectAccess, 'ref'>>> = {
  activate: { permission: 'project:activate', risk: 'R1', writable: false },
  close: { permission: 'project:close', risk: 'R2', writable: false },
  reopen: { permission: 'project:reopen', risk: 'R2', writable: false },
  archive: { permission: 'project:archive', risk: 'R2', writable: false },
  unarchive: { permission: 'project:unarchive', risk: 'R3', writable: false },
  request_deletion: { permission: 'project:delete', risk: 'R3', writable: false },
  cancel_deletion: { permission: 'project:delete', risk: 'R3', writable: false },
};

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
 * @param input projet, transition et texte associé
 * @returns projet modifié
 */
export async function changeLifecycle(dependencies: PortfolioDependencies, context: ExecutionContext, input: LifecycleInput): Promise<Result<UseCaseOutput<Project>, DomainError>> {
  const loaded = await loadProject(dependencies, context, { ...ACCESS[input.action], ref: input.ref });
  if (!loaded.ok) return loaded;
  const changed = STEPS[input.action](loaded.value, { text: input.text, now: dependencies.clock.now() });
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
