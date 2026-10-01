/**
 * Serveur HTTP commun : corrélation, en-têtes de sécurité, sondes de santé, erreurs RFC 9457.
 *
 * Couche : haute (OPS). Règles : RI-SEC-06 (CSP stricte et en-têtes du §16.2), RI-SEC-04
 * (`/healthz`, `/readyz`), RI-API-04, RI-LOG-09 (corrélation), §5.13.
 */
import Fastify, { type FastifyError, type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import type { Logger } from './logger.ts';
import { HttpProblem, INTERNAL_PROBLEM, toProblemBody, type HttpProblemInit } from './problem.ts';
import { uuidv7 } from './secrets.ts';

/** Options du serveur HTTP. */
export interface HttpServerOptions {
  readonly logger: Logger;
  /** Contrôle de disponibilité (base et dépendances indispensables). */
  readonly readiness: () => Promise<boolean>;
  /** Proxys de confiance pour `X-Forwarded-For` (§4.7). */
  readonly trustedProxies: readonly string[];
  /** Active HSTS lorsque le service est exposé en HTTPS. */
  readonly https: boolean;
}

const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const BODY_LIMIT_BYTES = 1_048_576;
const HTTP_CLIENT_ERROR = 400;
const HTTP_SERVER_ERROR = 500;

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // Empreintes des deux seules balises <style> injectées par la façade DSFR (`color-scheme`).
  "style-src 'self' 'sha256-HzhUjVBe6Oi2wcxUM7bmy2Rp9VdLMHYDdYr9MalNmOY=' 'sha256-xVQ4mcypV0CvOtZpQgVcKpcoNvdUkR9BrwZBrtBbU+w='",
  // Le script du DSFR positionne des attributs de style (menus, modales) : seuls les attributs
  // sont admis, jamais les balises <style> ni les scripts en ligne.
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'content-security-policy': CONTENT_SECURITY_POLICY,
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  // Isolement inter-origines complet : seules des ressources de même origine sont chargées (#278, constat ZAP 90004).
  'cross-origin-embedder-policy': 'require-corp',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'x-frame-options': 'DENY',
};

/**
 * Convertit une erreur quelconque en problème RFC 9457.
 * @param error erreur interceptée
 * @returns problème à renvoyer
 */
function toProblem(error: FastifyError | Error): HttpProblemInit {
  if (error instanceof HttpProblem) {
    return error.init;
  }
  const status = 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : HTTP_SERVER_ERROR;
  if (status >= HTTP_CLIENT_ERROR && status < HTTP_SERVER_ERROR) {
    return { status, code: 'ops.malformed_request', title: 'Requête invalide', detail: 'La requête est mal formée. Vérifiez le format JSON et les en-têtes.' };
  }
  return INTERNAL_PROBLEM;
}

/**
 * Envoie un problème RFC 9457.
 * @param reply réponse
 * @param request requête
 * @param problem problème
 */
function sendProblem(reply: FastifyReply, request: FastifyRequest, problem: HttpProblemInit): void {
  void reply.code(problem.status).type('application/problem+json; charset=utf-8').send(toProblemBody(problem, request.id));
}

/**
 * Déclare les sondes de santé.
 * @param app instance
 * @param readiness contrôle de disponibilité
 */
function registerProbes(app: FastifyInstance, readiness: () => Promise<boolean>): void {
  app.get('/healthz', (_request, reply) => reply.send({ status: 'ok' }));
  app.get('/readyz', async (_request, reply) => {
    const ready = await readiness().catch(() => false);
    return reply.code(ready ? 200 : 503).send({ status: ready ? 'ready' : 'unavailable' });
  });
}

/**
 * Code SQLSTATE d'une erreur de base, seule information technique journalisée avec sa classe (§15.6).
 * @param error erreur interceptée
 * @returns code ou « aucun »
 */
function sqlStateOf(error: FastifyError): string {
  return 'code' in error && typeof error.code === 'string' && /^[0-9A-Z]{5}$/u.test(error.code) ? error.code : 'aucun';
}

/**
 * Déclare les crochets communs : corrélation, en-têtes de sécurité, journal des requêtes.
 * @param app instance
 * @param options options du serveur
 */
function registerHooks(app: FastifyInstance, options: HttpServerOptions): void {
  app.addHook('onSend', async (request, reply) => {
    void reply.header('x-request-id', request.id);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) void reply.header(name, value);
    if (options.https) void reply.header('strict-transport-security', 'max-age=31536000; includeSubDomains');
  });
  app.addHook('onResponse', async (request, reply) => {
    options.logger.emit('requestCompleted', {
      correlationId: request.id,
      method: request.method,
      route: request.routeOptions.url ?? 'inconnue',
      statusCode: reply.statusCode,
      durationMs: Math.round(reply.elapsedTime),
    });
  });
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const problem = toProblem(error);
    if (problem.status >= HTTP_SERVER_ERROR) options.logger.emit('requestFailed', { correlationId: request.id, errorClass: error.name, errorCode: sqlStateOf(error) });
    sendProblem(reply, request, problem);
  });
  app.setNotFoundHandler((request, reply) => {
    sendProblem(reply, request, { status: 404, code: 'ops.not_found', title: 'Ressource introuvable', detail: "La ressource demandée n'existe pas ou n'est pas accessible." });
  });
}

/**
 * Crée le serveur HTTP d'une unité de déploiement.
 * @param options journal, disponibilité, proxys de confiance
 * @returns instance Fastify configurée
 */
export function createHttpServer(options: HttpServerOptions): FastifyInstance {
  const app = Fastify({
    logger: false,
    bodyLimit: BODY_LIMIT_BYTES,
    trustProxy: options.trustedProxies.length > 0 ? [...options.trustedProxies] : false,
    genReqId: (request) => {
      const header = request.headers['x-request-id'];
      return typeof header === 'string' && REQUEST_ID_PATTERN.test(header) ? header : uuidv7(Date.now());
    },
  });
  registerHooks(app, options);
  registerProbes(app, options.readiness);
  return app;
}
