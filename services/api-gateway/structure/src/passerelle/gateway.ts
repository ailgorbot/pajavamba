/**
 * Passerelle HTTP : routes générées depuis le registre d'actions, authentification, CSRF,
 * en-têtes d'écriture, cookie de session.
 *
 * Couche : moyenne (api-gateway/structure), service technique sans règle métier (RI-SRV-05).
 * Règles : RI-API-01, RI-API-05, RI-SCR-04 (jeton dans l'URL refusé), RI-CNX-04 (cookie
 * `__Host-pv_session`, CSRF), RI-SEC-04, §8.8.
 */
import type { ActionCall, ActionDefinition, ActionResponse, AuthenticatedPrincipal, IdentityClient, RegisteredAction } from '@pajavamba/contracts';
import { toEntityId, type ExecutionContext } from '@pajavamba/kernel';
import type {} from '@fastify/cookie';
import { HttpProblem, UNAUTHENTICATED, type Logger } from '@pajavamba/ops';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/** Options de la passerelle. */
export interface GatewayOptions {
  readonly identity: IdentityClient;
  readonly actions: readonly RegisteredAction[];
  readonly logger: Logger;
  /** Vrai en HTTPS : cookie `__Host-` sécurisé ; faux uniquement en développement local. */
  readonly secureCookies: boolean;
}

const API_PREFIX = '/api/v1';
const TOKEN_PATTERN = /pvb_[a-z]+_/u;
const ETAG_PATTERN = /^(?:W\/)?"?(\d+)"?$/u;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9-]{8,100}$/u;

const TOKEN_IN_URL = new HttpProblem({
  status: 400,
  code: 'api.token_in_url',
  title: 'Jeton dans l’URL',
  detail: "Un jeton ne doit jamais figurer dans l'URL. Transmettez-le dans l'en-tête Authorization.",
});
const CSRF_INVALID = new HttpProblem({ status: 403, code: 'api.csrf_invalid', title: 'Jeton CSRF invalide', detail: 'Rechargez la page puis réessayez.' });
const IDEMPOTENCY_REQUIRED = new HttpProblem({
  status: 428,
  code: 'request.precondition_required',
  title: 'En-tête Idempotency-Key requis',
  detail: 'Fournissez un en-tête Idempotency-Key (UUID) pour toute écriture POST.',
});

/**
 * Nom du cookie de session : `__Host-` exige HTTPS ; le nom court sert au développement local.
 * @param secure cookies sécurisés
 * @returns nom du cookie
 */
function cookieName(secure: boolean): string {
  return secure ? '__Host-pv_session' : 'pv_session';
}

/**
 * Lit un en-tête simple.
 * @param request requête
 * @param name nom
 * @returns valeur ou `null`
 */
function header(request: FastifyRequest, name: string): string | null {
  const value = request.headers[name];
  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * Authentifie la requête : clé API en en-tête, sinon cookie de session.
 * @param options options
 * @param request requête
 * @returns principal, canal et secret de session
 */
async function authenticate(
  options: GatewayOptions,
  request: FastifyRequest,
): Promise<{ readonly principal: AuthenticatedPrincipal | undefined; readonly channel: 'ui' | 'api'; readonly sessionSecret: string | null }> {
  const authorization = header(request, 'authorization');
  if (authorization?.startsWith('Bearer ') === true) {
    const principal = await options.identity.authenticateApiKey(authorization.slice('Bearer '.length).trim());
    if (principal === undefined) throw UNAUTHENTICATED;
    return { principal, channel: 'api', sessionSecret: null };
  }
  const secret = request.cookies[cookieName(options.secureCookies)] ?? null;
  const principal = secret === null ? undefined : await options.identity.authenticateSession(secret);
  return { principal, channel: 'ui', sessionSecret: principal === undefined ? null : secret };
}

/**
 * Refuse tout jeton transmis dans l'URL (RI-SCR-04).
 * @param options options
 * @param request requête
 */
function rejectTokenInUrl(options: GatewayOptions, request: FastifyRequest): void {
  if (TOKEN_PATTERN.test(decodeURIComponent(request.url))) {
    options.logger.emit('tokenInUrlRejected', { correlationId: request.id });
    throw TOKEN_IN_URL;
  }
}

/**
 * Construit l'appel d'action.
 * @param request requête
 * @param context contexte éventuel
 * @param sessionSecret secret de session
 * @returns appel
 */
function buildCall(request: FastifyRequest, context: ExecutionContext | undefined, sessionSecret: string | null): ActionCall {
  const ifMatch = ETAG_PATTERN.exec(header(request, 'if-match') ?? '');
  const query = Object.fromEntries(Object.entries(request.query as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  const idempotencyKey = header(request, 'idempotency-key');
  return {
    context,
    params: request.params as Record<string, string>,
    query,
    body: request.body,
    headers: {
      idempotencyKey: idempotencyKey !== null && IDEMPOTENCY_PATTERN.test(idempotencyKey) ? idempotencyKey : null,
      ifMatch: ifMatch?.[1] === undefined ? null : Number(ifMatch[1]),
      dryRun: query['dryRun'] === 'true',
    },
    sessionSecret,
    clientIp: request.ip,
    userAgent: header(request, 'user-agent') ?? '',
    correlationId: request.id,
  };
}

/**
 * Envoie la réponse d'une action.
 * @param options options
 * @param reply réponse
 * @param response réponse de l'action
 * @returns réponse Fastify
 */
function send(options: GatewayOptions, reply: FastifyReply, response: ActionResponse): FastifyReply {
  const name = cookieName(options.secureCookies);
  if (response.sessionCookie !== undefined) {
    const base = { path: '/', httpOnly: true, secure: options.secureCookies, sameSite: 'lax' as const };
    if ('set' in response.sessionCookie) void reply.setCookie(name, response.sessionCookie.set, { ...base, maxAge: response.sessionCookie.maxAgeSeconds });
    else void reply.clearCookie(name, base);
  }
  if (response.etag !== undefined) void reply.header('etag', `"${String(response.etag)}"`);
  void reply.header('cache-control', 'no-store');
  return response.status === 204 ? reply.code(204).send() : reply.code(response.status).send(response.body);
}

/** Résultat de l'authentification d'une requête. */
type Authentication = Awaited<ReturnType<typeof authenticate>>;

/**
 * Exige l'authentification (hors actions publiques) et le jeton CSRF des écritures par cookie.
 * @param definition action
 * @param request requête
 * @param authentication principal et canal
 */
function guardAccess(definition: ActionDefinition, request: FastifyRequest, authentication: Authentication): void {
  const { principal, channel } = authentication;
  if (principal === undefined) {
    if (definition.permission !== 'public') throw UNAUTHENTICATED;
    return;
  }
  if (definition.method !== 'GET' && channel === 'ui' && header(request, 'x-csrf-token') !== principal.csrfToken) throw CSRF_INVALID;
}

/**
 * Exige `Idempotency-Key` sur les écritures POST authentifiées portant une permission (RI-API-05).
 * @param definition action
 * @param call appel
 */
function guardIdempotency(definition: ActionDefinition, call: ActionCall): void {
  const exempt = definition.permission === 'public' || definition.permission === 'self';
  if (definition.method === 'POST' && !exempt && call.headers.idempotencyKey === null) throw IDEMPOTENCY_REQUIRED;
}

/**
 * Contexte d'exécution de la requête authentifiée.
 * @param request requête
 * @param authentication principal et canal
 * @returns contexte, ou `undefined` sans authentification
 */
function contextOf(request: FastifyRequest, authentication: Authentication): ExecutionContext | undefined {
  const { principal, channel } = authentication;
  if (principal === undefined) return undefined;
  return { organisationId: principal.organisationId, actor: { kind: 'user', userId: principal.userId }, channel, credential: principal.credential, correlationId: toEntityId(request.id) };
}

/**
 * Enregistre une action du registre comme route REST.
 * @param app instance Fastify
 * @param options options
 * @param action action
 */
function registerAction(app: FastifyInstance, options: GatewayOptions, action: RegisteredAction): void {
  const { definition } = action;
  app.route({
    method: definition.method,
    url: `${API_PREFIX}${definition.path}`,
    handler: async (request, reply) => {
      rejectTokenInUrl(options, request);
      const authentication = await authenticate(options, request);
      guardAccess(definition, request, authentication);
      const call = buildCall(request, contextOf(request, authentication), authentication.sessionSecret);
      guardIdempotency(definition, call);
      return send(options, reply, await action.handle(call));
    },
  });
}

/**
 * Enregistre toutes les actions du registre.
 * @param app instance Fastify (avec `@fastify/cookie`)
 * @param options options
 */
export function registerGateway(app: FastifyInstance, options: GatewayOptions): void {
  for (const action of options.actions) {
    registerAction(app, options, action);
  }
}
