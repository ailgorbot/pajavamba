/**
 * Chaîne d'écriture générique : idempotence, simulation, outbox transactionnelle.
 *
 * Couche : haute (OPS), sans connaissance métier. Règles : RI-ARC-11 et RI-AUD-01 (agrégat,
 * événements et audit dans la même transaction), RI-API-05 (`Idempotency-Key`, `dryRun`),
 * RI-HAB-12 (refus audités).
 */
import type pg from 'pg';
import { withTransaction, type SqlExecutor, type TransactionScope } from './database.ts';
import { HttpProblem } from './problem.ts';
import { uuidv7 } from './secrets.ts';

/** Message écrit dans l'outbox du service. */
export interface OutboxMessage {
  readonly kind: 'event' | 'audit';
  readonly type: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly payload: unknown;
}

/** Résultat d'un traitement d'écriture. */
export interface WriteOutcome<B> {
  readonly status: number;
  readonly body: B;
  readonly outbox: readonly OutboxMessage[];
}

/** Paramètres d'une écriture. */
export interface WriteRequest {
  readonly pool: pg.Pool;
  readonly scope: Omit<TransactionScope, 'rollback'>;
  readonly correlationId: string;
  readonly idempotencyKey: string | null;
  readonly requestHash: string;
  readonly dryRun: boolean;
  /** Appelé après validation de la transaction (réveil du relais). */
  readonly onCommitted: () => void;
}

/** Réponse d'une écriture. */
export interface WriteResponse {
  readonly status: number;
  readonly body: unknown;
  readonly replayed: boolean;
}

interface StoredResponse {
  readonly request_hash: string;
  readonly status_code: number;
  readonly response: unknown;
}

/**
 * Insère les messages dans l'outbox du schéma courant.
 * @param tx transaction
 * @param request écriture
 * @param messages messages à publier
 */
export async function insertOutbox(tx: SqlExecutor, request: Pick<WriteRequest, 'scope' | 'correlationId'>, messages: readonly OutboxMessage[]): Promise<void> {
  for (const message of messages) {
    await tx.query(
      `INSERT INTO outbox_events (id, organisation_id, kind, type, aggregate_id, aggregate_version, correlation_id, actor_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [uuidv7(Date.now()), request.scope.organisationId ?? null, message.kind, message.type, message.aggregateId, message.aggregateVersion, request.correlationId, request.scope.actorId ?? null, JSON.stringify(message.payload)],
    );
  }
}

/**
 * Relit une réponse déjà produite pour la même clé d'idempotence.
 * @param tx transaction
 * @param request écriture
 * @returns réponse stockée ou `undefined`
 */
async function findReplay(tx: SqlExecutor, request: WriteRequest): Promise<StoredResponse | undefined> {
  if (request.idempotencyKey === null) {
    return undefined;
  }
  const rows = await tx.query<StoredResponse>('SELECT request_hash, status_code, response FROM idempotency_keys WHERE key = $1', [request.idempotencyKey]);
  const stored = rows[0];
  if (stored !== undefined && stored.request_hash !== request.requestHash) {
    throw new HttpProblem({ status: 422, code: 'ops.idempotency_key_reused', title: "Clé d'idempotence déjà utilisée", detail: "Cette clé d'idempotence a déjà servi pour une requête différente. Générez une nouvelle clé." });
  }
  return stored;
}

/**
 * Écrit les entrées d'audit d'un échec dans une transaction distincte.
 * @param request écriture
 * @param problem problème levé
 */
async function auditFailure(request: WriteRequest, problem: HttpProblem): Promise<void> {
  const messages = problem.init.auditOnFailure ?? [];
  if (messages.length === 0) {
    return;
  }
  await withTransaction(request.pool, request.scope, (tx) => insertOutbox(tx, request, messages.map((message) => ({ ...message, aggregateVersion: 0 }))));
  request.onCommitted();
}

/**
 * Exécute une écriture : rejeu idempotent, simulation, outbox et clé d'idempotence dans la transaction.
 * @param request paramètres de l'écriture
 * @param handler traitement métier transactionnel
 * @returns réponse à renvoyer
 */
export async function executeWrite<B>(request: WriteRequest, handler: (tx: SqlExecutor) => Promise<WriteOutcome<B>>): Promise<WriteResponse> {
  try {
    const response = await withTransaction(request.pool, { ...request.scope, rollback: request.dryRun }, async (tx) => {
      const replay = await findReplay(tx, request);
      if (replay !== undefined) {
        return { status: replay.status_code, body: replay.response, replayed: true };
      }
      const outcome = await handler(tx);
      await insertOutbox(tx, request, outcome.outbox);
      if (request.idempotencyKey !== null && !request.dryRun) {
        await tx.query('INSERT INTO idempotency_keys (organisation_id, key, request_hash, status_code, response) VALUES ($1, $2, $3, $4, $5)', [request.scope.organisationId ?? null, request.idempotencyKey, request.requestHash, outcome.status, JSON.stringify(outcome.body)]);
      }
      return { status: outcome.status, body: outcome.body, replayed: false };
    });
    if (!request.dryRun && !response.replayed) {
      request.onCommitted();
    }
    return response;
  } catch (error) {
    if (error instanceof HttpProblem) {
      await auditFailure(request, error);
    }
    throw error;
  }
}
