/**
 * Exécution générique d'une action : transaction, cas d'usage, outbox (événements + audit),
 * conversion des erreurs métier, audit des refus.
 *
 * Couche : haute (OPS). Aucune connaissance métier : les formes sont structurelles.
 * Règles : RI-ARC-06, RI-ARC-11, RI-AUD-01, RI-AUD-03, RI-AUD-04 (noms de champs uniquement),
 * RI-HAB-12 (refus audités).
 */
import type pg from 'pg';
import { withTransaction, type SqlExecutor } from './database.ts';
import { problemFromDomainError, type DomainErrorShape } from './domain-problem.ts';
import type { FailureOutboxMessage } from './problem.ts';
import { executeWrite, type OutboxMessage, type WriteResponse } from './write-pipeline.ts';

/** Forme structurelle du contexte d'exécution. */
export interface ContextShape {
  readonly organisationId: string;
  readonly actor: { readonly kind: 'user'; readonly userId: string } | { readonly kind: 'system' };
  readonly channel: string;
  readonly correlationId: string;
}

/** Forme structurelle d'un événement du domaine. */
export interface EventShape {
  readonly type: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly data: unknown;
}

/** Forme structurelle d'un `Result` de cas d'usage. */
export type UseCaseResultShape<T> =
  | { readonly ok: true; readonly value: { readonly result: T; readonly events: readonly EventShape[] } }
  | { readonly ok: false; readonly error: DomainErrorShape };

/** Description d'une action d'écriture à exécuter. */
export interface WriteActionSpec<T> {
  readonly pool: pg.Pool;
  readonly scope: { readonly schema: string; readonly role: string };
  readonly context: ContextShape;
  readonly actionId: string;
  readonly resourceType: string;
  readonly idempotencyKey: string | null;
  readonly dryRun: boolean;
  readonly requestHash: string;
  readonly onCommitted: () => void;
  execute(tx: SqlExecutor): Promise<UseCaseResultShape<T>>;
  respond(result: T): { readonly status: number; readonly body: unknown };
  resourceId(result: T): string | null;
  /** Noms des champs modifiés, pour l'audit. */
  readonly changedFields: readonly string[];
}

/**
 * Construit l'entrée d'audit d'une action.
 * @param context contexte
 * @param spec action
 * @param decision décision
 * @param resourceId ressource
 * @returns charge utile d'audit
 */
function auditPayload(context: ContextShape, spec: Pick<WriteActionSpec<unknown>, 'actionId' | 'resourceType' | 'changedFields'>, decision: 'allow' | 'deny', resourceId: string | null): Record<string, unknown> {
  return {
    occurredAt: new Date().toISOString(),
    organisationId: context.organisationId,
    actorType: context.actor.kind,
    actorId: context.actor.kind === 'user' ? context.actor.userId : null,
    channel: context.channel,
    action: spec.actionId,
    resourceType: spec.resourceType,
    resourceId,
    decision,
    correlationId: context.correlationId,
    changedFields: decision === 'allow' ? spec.changedFields : [],
  };
}

/**
 * Entrée d'audit d'un refus (écrite hors de la transaction annulée).
 * @param spec action
 * @returns message d'outbox
 */
export function denialAudit(spec: Pick<WriteActionSpec<unknown>, 'context' | 'actionId' | 'resourceType' | 'changedFields'>): FailureOutboxMessage {
  return { kind: 'audit', type: 'pv.audit.entry.v1', aggregateId: spec.actionId, payload: auditPayload(spec.context, spec, 'deny', null) };
}

/**
 * Exécute une action d'écriture.
 * @param spec description de l'action
 * @returns réponse à renvoyer
 */
export async function runWriteAction<T>(spec: WriteActionSpec<T>): Promise<WriteResponse<unknown>> {
  const actorId = spec.context.actor.kind === 'user' ? spec.context.actor.userId : undefined;
  const organisation = spec.context.organisationId === '' ? {} : { organisationId: spec.context.organisationId };
  const scope = { ...spec.scope, ...organisation, ...(actorId === undefined ? {} : { actorId }) };
  return executeWrite({ pool: spec.pool, scope, correlationId: spec.context.correlationId, idempotencyKey: spec.idempotencyKey, requestHash: spec.requestHash, dryRun: spec.dryRun, onCommitted: spec.onCommitted }, async (tx) => {
    const outcome = await spec.execute(tx);
    if (!outcome.ok) {
      throw problemFromDomainError(outcome.error, outcome.error.kind === 'forbidden' ? [denialAudit(spec)] : []);
    }
    const { result, events } = outcome.value;
    const resourceId = spec.resourceId(result);
    const messages: OutboxMessage[] = events.map((event) => ({ kind: 'event', type: event.type, aggregateId: event.aggregateId, aggregateVersion: event.aggregateVersion, payload: event.data }));
    messages.push({ kind: 'audit', type: 'pv.audit.entry.v1', aggregateId: resourceId ?? spec.actionId, aggregateVersion: 0, payload: auditPayload(spec.context, spec, 'allow', resourceId) });
    return { ...spec.respond(result), outbox: messages };
  });
}

/** Description d'une action de lecture. */
export interface ReadActionSpec<T> {
  readonly pool: pg.Pool;
  readonly scope: { readonly schema: string; readonly role: string };
  readonly organisationId: string;
  execute(tx: SqlExecutor): Promise<{ readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: DomainErrorShape }>;
}

/**
 * Exécute une action de lecture ; les erreurs métier deviennent des problèmes HTTP.
 * @param spec description
 * @returns valeur lue
 */
export async function runReadAction<T>(spec: ReadActionSpec<T>): Promise<T> {
  const outcome = await withTransaction(spec.pool, { ...spec.scope, organisationId: spec.organisationId }, (tx) => spec.execute(tx));
  if (!outcome.ok) {
    throw problemFromDomainError(outcome.error);
  }
  return outcome.value;
}
