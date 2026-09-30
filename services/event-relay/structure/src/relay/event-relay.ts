/**
 * Relais des outbox : lecture ordonnée, distribution aux consommateurs, reprises, lettres mortes.
 *
 * Couche : moyenne (event-relay/structure), service technique sans règle métier (RI-SRV-05).
 * Règles : RI-SRV-11 (ordre par agrégat : traitement séquentiel par schéma), §5.7 (au moins une
 * fois, reprises, lettres mortes), RI-DON-11 (CloudEvents).
 */
import type { CloudEvent, EventConsumer } from '@pajavamba/contracts';
import { uuidv7, withTransaction, type Logger, type SqlExecutor } from '@pajavamba/ops';
import type pg from 'pg';

/** Type réservé aux entrées d'audit écrites dans les outbox. */
export const AUDIT_ENTRY_TYPE = 'pv.audit.entry.v1';

const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 1_000;
const RELAY_ROLE = 'pv_event_relay_app';

interface OutboxRow {
  readonly seq: string;
  readonly id: string;
  readonly organisation_id: string | null;
  readonly kind: 'event' | 'audit';
  readonly type: string;
  readonly aggregate_id: string;
  readonly aggregate_version: number;
  readonly correlation_id: string;
  readonly actor_id: string | null;
  readonly payload: CloudEvent['data'];
  readonly created_at: Date;
}

/** Relais d'événements. */
export interface EventRelay {
  /** Demande un passage immédiat (après validation d'une transaction). */
  kick(): void;
  /** Traite toutes les outbox jusqu'à épuisement ; retourne le nombre de messages relayés. */
  drain(): Promise<number>;
  start(): void;
  stop(): Promise<void>;
}

/** Paramètres du relais. */
export interface EventRelaySettings {
  readonly pool: pg.Pool;
  readonly schemas: readonly string[];
  readonly consumers: readonly EventConsumer[];
  readonly logger: Logger;
}

/**
 * Convertit une ligne d'outbox en CloudEvent.
 * @param schema schéma d'origine
 * @param row ligne
 * @returns événement
 */
function toCloudEvent(schema: string, row: OutboxRow): CloudEvent {
  return {
    specversion: '1.0', id: row.id, source: `/pajavamba/${schema}`, type: row.kind === 'audit' ? AUDIT_ENTRY_TYPE : row.type, subject: row.aggregate_id,
    time: row.created_at.toISOString(), datacontenttype: 'application/json', pvorganisation: row.organisation_id ?? '', pvactor: row.actor_id,
    pvaggregateversion: row.aggregate_version, pvcorrelation: row.correlation_id, data: row.payload,
  };
}

/**
 * Crée le relais.
 * @param settings pool, schémas, consommateurs, journal
 * @returns relais
 */
export function createEventRelay(settings: EventRelaySettings): EventRelay {
  const attempts = new Map<string, number>();
  let running: Promise<number> | undefined;
  let timer: NodeJS.Timeout | undefined;
  let again = false;

  const deliver = async (tx: SqlExecutor, schema: string, row: OutboxRow): Promise<boolean> => {
    const event = toCloudEvent(schema, row);
    for (const consumer of settings.consumers.filter((candidate) => candidate.types.includes(event.type))) {
      try {
        await consumer.handle(event);
      } catch (error) {
        const count = (attempts.get(row.id) ?? 0) + 1;
        attempts.set(row.id, count);
        settings.logger.emit('eventConsumerFailed', { eventType: event.type, service: consumer.name, count, errorClass: error instanceof Error ? error.name : 'inconnue' });
        if (count < MAX_ATTEMPTS) return false;
        await tx.query('INSERT INTO events.dead_letters (id, source_schema, event_id, consumer, event_type, attempts, error_class) VALUES ($1, $2, $3, $4, $5, $6, $7)', [uuidv7(Date.now()), schema, row.id, consumer.name, event.type, count, error instanceof Error ? error.name : 'inconnue']);
      }
    }
    attempts.delete(row.id);
    return true;
  };

  const relaySchema = async (schema: string): Promise<number> =>
    withTransaction(settings.pool, { schema, role: RELAY_ROLE }, async (tx) => {
      const rows = await tx.query<OutboxRow>(`SELECT seq, id, organisation_id, kind, type, aggregate_id, aggregate_version, correlation_id, actor_id, payload, created_at FROM outbox_events WHERE published_at IS NULL ORDER BY seq LIMIT ${String(BATCH_SIZE)} FOR UPDATE SKIP LOCKED`);
      let relayed = 0;
      for (const row of rows) {
        if (!(await deliver(tx, schema, row))) break;
        await tx.query('UPDATE outbox_events SET published_at = now() WHERE seq = $1', [row.seq]);
        relayed += 1;
      }
      return relayed;
    });

  const drainOnce = async (): Promise<number> => {
    let total = 0;
    for (;;) {
      let pass = 0;
      for (const schema of settings.schemas) pass += await relaySchema(schema);
      total += pass;
      if (pass === 0) return total;
    }
  };

  const drain = async (): Promise<number> => {
    if (running !== undefined) {
      again = true;
      return running;
    }
    running = (async () => {
      let total = 0;
      do {
        again = false;
        total += await drainOnce();
      } while (again);
      return total;
    })().finally(() => {
      running = undefined;
    });
    return running;
  };

  return {
    kick: () => {
      void drain().catch(() => undefined);
    },
    drain,
    start: () => {
      timer = setInterval(() => {
        void drain().catch(() => undefined);
      }, POLL_INTERVAL_MS);
    },
    stop: async () => {
      if (timer !== undefined) clearInterval(timer);
      await running;
    },
  };
}
