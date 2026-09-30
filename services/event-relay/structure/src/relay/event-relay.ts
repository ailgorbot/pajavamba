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

/** Tentatives en échec par événement (reprises bornées avant lettre morte). */
type Attempts = Map<string, number>;

/** Message d'outbox à distribuer. */
interface Delivery {
  readonly tx: SqlExecutor;
  readonly schema: string;
  readonly row: OutboxRow;
}

/**
 * Consigne un échec de consommateur ; au-delà des reprises, écrit une lettre morte.
 * @param settings paramètres du relais
 * @param attempts compteur de tentatives
 * @param failure distribution, consommateur et erreur
 * @returns vrai si le message peut être considéré comme traité (lettre morte écrite)
 */
async function recordFailure(settings: EventRelaySettings, attempts: Attempts, failure: Delivery & { readonly consumer: EventConsumer; readonly error: unknown }): Promise<boolean> {
  const { tx, schema, row, consumer } = failure;
  const errorClass = failure.error instanceof Error ? failure.error.name : 'inconnue';
  const count = (attempts.get(row.id) ?? 0) + 1;
  attempts.set(row.id, count);
  settings.logger.emit('eventConsumerFailed', { eventType: row.type, service: consumer.name, count, errorClass });
  if (count < MAX_ATTEMPTS) return false;
  await tx.query('INSERT INTO events.dead_letters (id, source_schema, event_id, consumer, event_type, attempts, error_class) VALUES ($1, $2, $3, $4, $5, $6, $7)', [uuidv7(Date.now()), schema, row.id, consumer.name, row.type, count, errorClass]);
  return true;
}

/**
 * Distribue un message à ses consommateurs.
 * @param settings paramètres du relais
 * @param attempts compteur de tentatives
 * @param delivery transaction, schéma et message
 * @returns vrai si le message est traité (ou mis en lettre morte)
 */
async function deliver(settings: EventRelaySettings, attempts: Attempts, delivery: Delivery): Promise<boolean> {
  const event = toCloudEvent(delivery.schema, delivery.row);
  for (const consumer of settings.consumers.filter((candidate) => candidate.types.includes(event.type))) {
    try {
      await consumer.handle(event);
    } catch (error) {
      if (!(await recordFailure(settings, attempts, { ...delivery, consumer, error }))) return false;
    }
  }
  attempts.delete(delivery.row.id);
  return true;
}

/**
 * Relaie un lot de messages d'un schéma, dans l'ordre, en s'arrêtant au premier échec (ordre par agrégat).
 * @param settings paramètres du relais
 * @param attempts compteur de tentatives
 * @param schema schéma
 * @returns nombre de messages relayés
 */
async function relaySchema(settings: EventRelaySettings, attempts: Attempts, schema: string): Promise<number> {
  return withTransaction(settings.pool, { schema, role: RELAY_ROLE }, async (tx) => {
    const rows = await tx.query<OutboxRow>(`SELECT seq, id, organisation_id, kind, type, aggregate_id, aggregate_version, correlation_id, actor_id, payload, created_at FROM outbox_events WHERE published_at IS NULL ORDER BY seq LIMIT ${String(BATCH_SIZE)} FOR UPDATE SKIP LOCKED`);
    let relayed = 0;
    for (const row of rows) {
      if (!(await deliver(settings, attempts, { tx, schema, row }))) break;
      await tx.query('UPDATE outbox_events SET published_at = now() WHERE seq = $1', [row.seq]);
      relayed += 1;
    }
    return relayed;
  });
}

/**
 * Relaie tous les schémas jusqu'à épuisement.
 * @param settings paramètres du relais
 * @param attempts compteur de tentatives
 * @returns nombre de messages relayés
 */
async function drainAll(settings: EventRelaySettings, attempts: Attempts): Promise<number> {
  let total = 0;
  for (;;) {
    let pass = 0;
    for (const schema of settings.schemas) pass += await relaySchema(settings, attempts, schema);
    total += pass;
    if (pass === 0) return total;
  }
}

/** État de regroupement des passages du relais. */
interface RelayState {
  running: Promise<number> | undefined;
  again: boolean;
  timer: NodeJS.Timeout | undefined;
}

/**
 * Consomme la demande de passage supplémentaire arrivée pendant un passage.
 * @param state état du relais
 * @returns vrai si un nouveau passage est demandé
 */
function takeAgain(state: RelayState): boolean {
  const again = state.again;
  state.again = false;
  return again;
}

/**
 * Enchaîne les passages tant que de nouvelles demandes arrivent.
 * @param settings paramètres du relais
 * @param attempts compteur de tentatives
 * @param state état du relais
 * @returns nombre de messages relayés
 */
async function loop(settings: EventRelaySettings, attempts: Attempts, state: RelayState): Promise<number> {
  let total = await drainAll(settings, attempts);
  while (takeAgain(state)) total += await drainAll(settings, attempts);
  return total;
}

/**
 * Crée le relais : les demandes concurrentes sont regroupées en un seul passage supplémentaire.
 * @param settings pool, schémas, consommateurs, journal
 * @returns relais
 */
export function createEventRelay(settings: EventRelaySettings): EventRelay {
  const attempts: Attempts = new Map();
  const state: RelayState = { running: undefined, again: false, timer: undefined };
  const drain = async (): Promise<number> => {
    if (state.running !== undefined) {
      state.again = true;
      return state.running;
    }
    state.running = loop(settings, attempts, state).finally(() => {
      state.running = undefined;
    });
    return state.running;
  };
  return {
    kick: () => void drain().catch(() => undefined),
    drain,
    start: () => {
      state.timer = setInterval(() => void drain().catch(() => undefined), POLL_INTERVAL_MS);
    },
    stop: async () => {
      if (state.timer !== undefined) clearInterval(state.timer);
      await state.running;
    },
  };
}
