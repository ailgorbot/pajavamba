/**
 * Catalogue des types d'événements échangés entre services et enveloppe CloudEvents.
 *
 * Couche : contrats. Règles : RI-NOM-07 (`pv.<service>.<objet>.<verbe_passé>.v<N>`), RI-DON-11,
 * RI-SRV-11 (consommateurs idempotents, ordre par agrégat).
 */
import type { EventValue } from '@pajavamba/kernel';

/** Types d'événements publiés par les services du MVP. */
export const EVENT_TYPES = {
  organisationCreated: 'pv.identity.organisation.created.v1',
  userProvisioned: 'pv.identity.user.provisioned.v1',
  userUpdated: 'pv.identity.user.updated.v1',
  userDeactivated: 'pv.identity.user.deactivated.v1',
  userReactivated: 'pv.identity.user.reactivated.v1',
  roleAssigned: 'pv.identity.role.assigned.v1',
  roleRevoked: 'pv.identity.role.revoked.v1',
  sessionOpened: 'pv.identity.session.opened.v1',
  sessionRevoked: 'pv.identity.session.revoked.v1',
  loginFailed: 'pv.identity.login.failed.v1',
  mfaEnrolled: 'pv.identity.mfa.enrolled.v1',
  apiKeyCreated: 'pv.identity.api_key.created.v1',
  apiKeyRevoked: 'pv.identity.api_key.revoked.v1',
  accessDenied: 'pv.identity.access.denied.v1',
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
  teamAttached: 'pv.portfolio.team.attached.v1',
  packInstantiated: 'pv.workflow.pack.instantiated.v1',
  workflowPublished: 'pv.workflow.workflow.published.v1',
  workItemCreated: 'pv.workitem.work_item.created.v1',
  workItemUpdated: 'pv.workitem.work_item.updated.v1',
  workItemTransitioned: 'pv.workitem.work_item.transitioned.v1',
  workItemAssigned: 'pv.workitem.work_item.assigned.v1',
  workItemRanked: 'pv.workitem.work_item.ranked.v1',
  workItemDeleted: 'pv.workitem.work_item.deleted.v1',
  workItemRestored: 'pv.workitem.work_item.restored.v1',
  commentAdded: 'pv.workitem.comment.added.v1',
} as const;

/** Enveloppe CloudEvents 1.0 d'un événement relayé. */
export interface CloudEvent {
  readonly specversion: '1.0';
  readonly id: string;
  readonly source: string;
  readonly type: string;
  readonly subject: string;
  readonly time: string;
  readonly datacontenttype: 'application/json';
  readonly pvorganisation: string;
  readonly pvactor: string | null;
  readonly pvaggregateversion: number;
  readonly pvcorrelation: string;
  readonly data: Readonly<Record<string, EventValue>>;
}

/** Consommateur d'événements enregistré auprès du relais (idempotent, RI-SRV-11). */
export interface EventConsumer {
  /** Nom stable, clé d'idempotence dans `processed_events`. */
  readonly name: string;
  /** Types d'événements traités. */
  readonly types: readonly string[];
  handle(event: CloudEvent): Promise<void>;
}

/** Entrée d'audit écrite dans l'outbox avec l'événement métier (RI-ARC-11, RI-AUD-01). */
export interface AuditRecord {
  readonly occurredAt: string;
  readonly organisationId: string;
  readonly actorType: 'user' | 'system';
  readonly actorId: string | null;
  readonly channel: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly decision: 'allow' | 'deny';
  readonly correlationId: string;
  /** Noms des champs modifiés, jamais les valeurs (RI-AUD-04). */
  readonly changedFields: readonly string[];
}
