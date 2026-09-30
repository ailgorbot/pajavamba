/**
 * Service audit : chaînage des entrées reçues des outbox, consultation et vérification.
 *
 * Couche : moyenne (audit/structure). Règles : RI-AUD-01 (entrées issues de l'outbox de la
 * transaction métier), RI-AUD-02, RI-AUD-03 (lecture de l'audit elle-même auditée), RI-HAB-02
 * (`audit:read` est R3), RI-LOG-10.
 */
import { join } from 'node:path';
import { chainHash, GENESIS_HASH, verifyChain, type AuditContent, type ChainedEntry } from '@pajavamba/audit-fonctionnel';
import { defineAction, type EventConsumer, type RegisteredAction } from '@pajavamba/contracts';
import { requireAccess, type AccessPolicy } from '@pajavamba/kernel';
import { consumeOnce, insertOutbox, problemFromDomainError, requireContext, sha256Hex, withTransaction, type MigrationSet, type SqlExecutor } from '@pajavamba/ops';
import type pg from 'pg';

/** Migrations du service audit. */
export const AUDIT_MIGRATIONS: MigrationSet = { service: 'audit', directory: join(import.meta.dirname, '../../migrations') };

/** Organisation technique portant la chaîne des actions hors organisation (initialisation, connexion). */
export const INSTANCE_CHAIN = '00000000-0000-0000-0000-000000000000';

const SCOPE = { schema: 'audit', role: 'pv_audit_app' } as const;
const CONSUMER = 'audit.chain';
const PAGE = 200;

/**
 * Valeur textuelle d'un champ d'événement (chaîne vide si absent ou d'un autre type).
 * @param value valeur
 * @returns texte
 */
function textOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

interface EntryRow {
  readonly seq: string;
  readonly occurred_at: Date;
  readonly actor_type: string;
  readonly actor_id: string | null;
  readonly channel: string;
  readonly action: string;
  readonly resource_type: string;
  readonly resource_id: string | null;
  readonly decision: 'allow' | 'deny';
  readonly correlation_id: string;
  readonly changed_fields: readonly string[];
  readonly prev_hash: string;
  readonly hash: string;
}

/** Paramètres du service audit. */
export interface AuditSettings {
  readonly pool: pg.Pool;
  readonly policy: AccessPolicy;
  readonly auditTypes: readonly string[];
  readonly notify: () => void;
}

/**
 * Convertit une ligne en entrée chaînée.
 * @param row ligne
 * @returns entrée
 */
function toEntry(row: EntryRow): ChainedEntry {
  const content: AuditContent = { occurredAt: row.occurred_at.toISOString(), actorType: row.actor_type, actorId: row.actor_id, channel: row.channel, action: row.action, resourceType: row.resource_type, resourceId: row.resource_id, decision: row.decision, correlationId: row.correlation_id, changedFields: row.changed_fields };
  return { seq: Number(row.seq), content, prevHash: row.prev_hash, hash: row.hash };
}

/**
 * Ajoute une entrée en fin de chaîne (verrou transactionnel par organisation).
 * @param tx transaction
 * @param entry organisation, entrée d'origine et contenu
 */
async function append(tx: SqlExecutor, entry: { readonly organisationId: string; readonly eventId: string; readonly content: AuditContent }): Promise<void> {
  const { organisationId, eventId, content } = entry;
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`audit:${organisationId}`]);
  const last = await tx.query<{ readonly seq: string; readonly hash: string }>('SELECT seq, hash FROM audit_entries WHERE organisation_id = $1 ORDER BY seq DESC LIMIT 1', [organisationId]);
  const prevHash = last[0]?.hash ?? GENESIS_HASH;
  await tx.query(
    `INSERT INTO audit_entries (organisation_id, seq, event_id, occurred_at, actor_type, actor_id, channel, action, resource_type, resource_id, decision, correlation_id, changed_fields, prev_hash, hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [organisationId, Number(last[0]?.seq ?? 0) + 1, eventId, content.occurredAt, content.actorType, content.actorId, content.channel, content.action, content.resourceType, content.resourceId, content.decision, content.correlationId, content.changedFields, prevHash, chainHash(sha256Hex, prevHash, content)],
  );
}

/**
 * Consommateur des entrées d'audit.
 * @param settings paramètres
 * @returns consommateur
 */
function chainConsumer(settings: AuditSettings): EventConsumer {
  return {
    name: CONSUMER,
    types: settings.auditTypes,
    async handle(event) {
      const organisationId = event.pvorganisation === '' ? INSTANCE_CHAIN : event.pvorganisation;
      const data = event.data;
      const content: AuditContent = {
        occurredAt: textOf(data['occurredAt']), actorType: textOf(data['actorType']), actorId: typeof data['actorId'] === 'string' ? data['actorId'] : null, channel: textOf(data['channel']),
        action: textOf(data['action']), resourceType: textOf(data['resourceType']), resourceId: typeof data['resourceId'] === 'string' ? data['resourceId'] : null,
        decision: data['decision'] === 'deny' ? 'deny' : 'allow', correlationId: textOf(data['correlationId']), changedFields: Array.isArray(data['changedFields']) ? data['changedFields'].map(String) : [],
      };
      await consumeOnce({ pool: settings.pool, scope: { ...SCOPE, organisationId }, consumer: CONSUMER, eventId: event.id, correlationId: event.pvcorrelation }, async (tx) => {
        await append(tx, { organisationId, eventId: event.id, content });
        return [];
      });
    },
  };
}

/**
 * Déclare les actions de consultation (la consultation est elle-même auditée).
 * @param settings paramètres
 * @returns actions
 */
function actions(settings: AuditSettings): RegisteredAction[] {
  const readChain = async (context: NonNullable<Parameters<RegisteredAction['handle']>[0]['context']>, action: string): Promise<readonly ChainedEntry[]> =>
    withTransaction(settings.pool, { ...SCOPE, organisationId: context.organisationId }, async (tx) => {
      const access = await requireAccess(settings.policy, context, { permission: 'audit:read', risk: 'R3' });
      if (!access.ok) throw problemFromDomainError(access.error);
      const rows = await tx.query<EntryRow>('SELECT * FROM audit_entries WHERE organisation_id = $1 ORDER BY seq', [context.organisationId]);
      const payload = { occurredAt: new Date().toISOString(), organisationId: context.organisationId, actorType: 'user', actorId: context.actor.kind === 'user' ? context.actor.userId : null, channel: context.channel, action, resourceType: 'audit', resourceId: null, decision: 'allow', correlationId: context.correlationId, changedFields: [] };
      await insertOutbox(tx, { scope: { ...SCOPE, organisationId: context.organisationId }, correlationId: context.correlationId }, [{ kind: 'audit', type: 'pv.audit.entry.v1', aggregateId: action, aggregateVersion: 0, payload }]);
      settings.notify();
      return rows.map(toEntry);
    });
  return [
    {
      definition: defineAction({ id: 'audit.list', permission: 'audit:read', risk: 'R3', method: 'GET', path: '/audit', reversible: true, description: "Consulte le journal d'audit de l'organisation (entrées les plus récentes).", rules: ['RG-IAM-003'] }),
      handle: async (call) => {
        const entries = await readChain(requireContext(call.context), 'audit.list');
        const recent = entries.slice(-PAGE).reverse();
        return { status: 200, body: { data: recent.map((entry) => ({ seq: entry.seq, ...entry.content, hash: entry.hash })), page: { nextCursor: null, limit: recent.length } } };
      },
    },
    {
      definition: defineAction({ id: 'audit.verify', permission: 'audit:read', risk: 'R3', method: 'GET', path: '/audit/verification', reversible: true, description: "Vérifie l'intégrité de la chaîne d'audit.", rules: [] }),
      handle: async (call) => {
        const entries = await readChain(requireContext(call.context), 'audit.verify');
        const broken = verifyChain(sha256Hex, entries, GENESIS_HASH);
        return { status: 200, body: { entries: entries.length, intact: broken === null, firstInvalidSeq: broken } };
      },
    },
  ];
}

/** Service audit câblé. */
export interface AuditService {
  readonly actions: readonly RegisteredAction[];
  readonly consumers: readonly EventConsumer[];
}

/**
 * Câble le service audit.
 * @param settings paramètres
 * @returns service câblé
 */
export function createAuditService(settings: AuditSettings): AuditService {
  return { actions: actions(settings), consumers: [chainConsumer(settings)] };
}
