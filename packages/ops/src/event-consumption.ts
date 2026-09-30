/**
 * Consommation idempotente d'un événement : table `processed_events` du schéma consommateur.
 *
 * Couche : haute (OPS), sans connaissance métier. Règles : RI-SRV-11 (consommateurs idempotents),
 * §5.7 (livraison au moins une fois).
 */
import type pg from 'pg';
import { withTransaction, type SqlExecutor, type TransactionScope } from './database.ts';
import { insertOutbox, type OutboxMessage } from './write-pipeline.ts';

/** Paramètres d'une consommation. */
export interface ConsumptionRequest {
  readonly pool: pg.Pool;
  readonly scope: Omit<TransactionScope, 'rollback'>;
  readonly consumer: string;
  readonly eventId: string;
  readonly correlationId: string;
}

/**
 * Exécute le traitement d'un événement une seule fois par consommateur, dans une transaction ;
 * les messages retournés sont écrits dans l'outbox du consommateur (saga).
 * @param request pool, portée, consommateur et événement
 * @param work traitement transactionnel
 * @returns vrai si l'événement a été traité, faux s'il l'avait déjà été
 */
export async function consumeOnce(request: ConsumptionRequest, work: (tx: SqlExecutor) => Promise<readonly OutboxMessage[]>): Promise<boolean> {
  return withTransaction(request.pool, request.scope, async (tx) => {
    const inserted = await tx.query<{ readonly event_id: string }>(
      'INSERT INTO processed_events (consumer, event_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING event_id',
      [request.consumer, request.eventId],
    );
    if (inserted.length === 0) {
      return false;
    }
    const messages = await work(tx);
    await insertOutbox(tx, request, messages);
    return true;
  });
}
