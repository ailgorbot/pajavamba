/**
 * Unité de déploiement `pv-app` : regroupe, par configuration, la passerelle, les services du MVP,
 * le relais d'événements, l'audit et l'interface compilée.
 *
 * Règles : RI-SRV-09 (regroupement = configuration ; les services ne s'importent pas entre eux),
 * RI-ARC-09 (câblage manuel), RI-SRV-08 (sans état), §4.3.
 */
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { createAuditService } from '@pajavamba/audit-structure';
import { registerGateway } from '@pajavamba/api-gateway-structure';
import type { EventConsumer, RegisteredAction } from '@pajavamba/contracts';
import { AUDIT_ENTRY_TYPE, createEventRelay, type EventRelay } from '@pajavamba/event-relay-structure';
import { createIdentityRuntime, createIdentityService, createSecretService } from '@pajavamba/identity-structure';
import type { Clock, IdGenerator } from '@pajavamba/kernel';
import { createHttpServer, createLogger, createPool, deriveKey, hashPassword, HttpProblem, loadConfig, randomSecret, uuidv7, type Logger } from '@pajavamba/ops';
import { createPolicyService } from '@pajavamba/policy-structure';
import { createPortfolioService } from '@pajavamba/portfolio-structure';
import { createQueryService } from '@pajavamba/query-structure';
import { createWorkflowService } from '@pajavamba/workflow-structure';
import { createWorkItemService } from '@pajavamba/workitem-structure';
import type { FastifyInstance } from 'fastify';
import { APP_SETTINGS, connectionString, type AppSettings } from './settings.ts';

const RELAYED_SCHEMAS = ['identity', 'policy', 'portfolio', 'workflow', 'workitem', 'query', 'audit'];
const MINUTE_MS = 60_000;
const API_NOT_FOUND = new HttpProblem({ status: 404, code: 'ops.not_found', title: 'Ressource introuvable', detail: "La ressource demandée n'existe pas ou n'est pas accessible." });

/** Services câblés de l'unité. */
interface Wiring {
  readonly actions: readonly RegisteredAction[];
  readonly consumers: readonly EventConsumer[];
  readonly identity: ReturnType<typeof createIdentityService>;
  readonly portfolio: ReturnType<typeof createPortfolioService>;
  readonly relay: EventRelay;
}

/**
 * Câble les services de l'unité.
 * @param settings configuration
 * @param logger journal
 * @param pool pool PostgreSQL
 * @returns services câblés
 */
async function wire(settings: AppSettings, logger: Logger, pool: ReturnType<typeof createPool>): Promise<Wiring> {
  const clock: Clock = { now: () => Date.now() };
  const ids: IdGenerator = { next: () => uuidv7(Date.now()) };
  const relayHolder: { relay?: EventRelay } = {};
  const notify = (): void => relayHolder.relay?.kick();
  const policy = createPolicyService(pool, clock);
  const common = { pool, clock, ids, policy: policy.accessPolicy, notify };
  const secrets = createSecretService({ pepper: settings.pepper, setupCode: settings.setupCode, dummyPasswordHash: await hashPassword(randomSecret(32)) });
  const identity = createIdentityService(createIdentityRuntime({ ...common, secrets, fieldKey: deriveKey(settings.fieldKey) }));
  const portfolio = createPortfolioService(common);
  const services = [identity, portfolio, createWorkflowService(common), createWorkItemService(common), createQueryService({ pool, policy: policy.accessPolicy }), createAuditService({ pool, policy: policy.accessPolicy, auditTypes: [AUDIT_ENTRY_TYPE], notify })];
  const consumers = [...policy.consumers, ...services.flatMap((service) => service.consumers)];
  const relay = createEventRelay({ pool, schemas: RELAYED_SCHEMAS, consumers, logger });
  relayHolder.relay = relay;
  return { actions: services.flatMap((service) => service.actions), consumers, identity, portfolio, relay };
}

/**
 * Sert l'interface compilée, avec repli vers `index.html` hors de l'API.
 * @param app instance
 * @param webDir répertoire de l'interface
 */
async function serveWeb(app: FastifyInstance, webDir: string): Promise<void> {
  if (webDir === '') return;
  await app.register(fastifyStatic, { root: webDir, wildcard: false, index: ['index.html'] });
  app.get('/*', async (request, reply) => {
    if (request.url.startsWith('/api/')) throw API_NOT_FOUND;
    return reply.header('cache-control', 'no-cache').sendFile('index.html');
  });
}

/**
 * Démarre l'unité.
 */
async function main(): Promise<void> {
  const settings = loadConfig('APP', APP_SETTINGS, process.env);
  const logger = createLogger({ service: 'pv-app', detail: settings.logDetail });
  const pool = createPool(connectionString({ ...settings, user: settings.dbUser, password: settings.dbPassword }), settings.dbPoolMax);
  const wiring = await wire(settings, logger, pool);
  const app = createHttpServer({ logger, trustedProxies: settings.trustedProxies, https: settings.https, readiness: async () => (await pool.query('SELECT 1')).rowCount === 1 });
  await app.register(fastifyCookie);
  registerGateway(app, { identity: wiring.identity.client, actions: wiring.actions, logger, secureCookies: settings.secureCookies });
  await serveWeb(app, settings.webDir);
  wiring.relay.start();
  const purge = setInterval(() => {
    void wiring.portfolio.purge(logger).catch(() => undefined);
  }, settings.purgeIntervalMinutes * MINUTE_MS);
  const stop = async (): Promise<void> => {
    logger.emit('serviceStopping', { service: 'pv-app' });
    clearInterval(purge);
    await app.close();
    await wiring.relay.stop();
    await pool.end();
  };
  process.once('SIGTERM', () => void stop());
  process.once('SIGINT', () => void stop());
  await app.listen({ host: settings.host, port: settings.port });
  logger.emit('serviceStarted', { service: 'pv-app', port: settings.port, version: process.env['PV_VERSION'] ?? 'dev' });
}

await main();
