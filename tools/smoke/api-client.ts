/**
 * Client HTTP minimal des tests de fumée : cookie de session, jeton CSRF, en-têtes d'écriture.
 *
 * Outillage (hors produit). Règles : RI-API-05 (Idempotency-Key, If-Match), RI-CNX-04 (CSRF).
 */
import { randomUUID } from 'node:crypto';

/** Réponse simplifiée. */
export interface ApiResult {
  readonly status: number;
  readonly body: Record<string, unknown>;
  readonly etag: string | null;
}

/** Options d'un appel. */
export interface CallOptions {
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

/** Client de l'API avec session. */
export interface ApiClient {
  call(method: string, path: string, options?: CallOptions): Promise<ApiResult>;
  setCsrf(token: string): void;
}

/** État de session du client. */
interface SessionState {
  cookie: string;
  csrf: string;
}

/**
 * En-têtes d'une requête selon la session et la méthode.
 * @param state session
 * @param method méthode HTTP
 * @param options corps et en-têtes supplémentaires
 * @returns en-têtes
 */
function headersFor(state: SessionState, method: string, options: CallOptions): Record<string, string> {
  const headers: Record<string, string> = { accept: 'application/json', ...options.headers };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (state.cookie !== '') headers['cookie'] = state.cookie;
  if (method !== 'GET' && state.csrf !== '') headers['x-csrf-token'] = state.csrf;
  if (method === 'POST') headers['idempotency-key'] ??= randomUUID();
  return headers;
}

/** Client de l'API avec session. */
export interface ApiClient {
  call(method: string, path: string, body?: unknown, extraHeaders?: Readonly<Record<string, string>>): Promise<ApiResult>;
  setCsrf(token: string): void;
}

/**
 * Crée un client de l'API.
 * @param baseUrl URL de base de l'instance
 * @returns client
 */
export function createApiClient(baseUrl: string): ApiClient {
  const state: SessionState = { cookie: '', csrf: '' };
  return {
    setCsrf: (token) => {
      state.csrf = token;
    },
    async call(method, path, options = {}) {
      const init = { method, headers: headersFor(state, method, options), ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) };
      const response = await fetch(`${baseUrl}/api/v1${path}`, init);
      const setCookie = response.headers.get('set-cookie');
      if (setCookie !== null) state.cookie = setCookie.split(';')[0] ?? '';
  let cookie = '';
  let csrf = '';
  return {
    setCsrf: (token) => {
      csrf = token;
    },
    async call(method, path, body, extraHeaders = {}) {
      const headers: Record<string, string> = { accept: 'application/json', ...extraHeaders };
      if (body !== undefined) headers['content-type'] = 'application/json';
      if (cookie !== '') headers['cookie'] = cookie;
      if (method !== 'GET' && csrf !== '') headers['x-csrf-token'] = csrf;
      if (method === 'POST') headers['idempotency-key'] ??= randomUUID();
      const response = await fetch(`${baseUrl}/api/v1${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const setCookie = response.headers.get('set-cookie');
      if (setCookie !== null) cookie = setCookie.split(';')[0] ?? '';
      const text = await response.text();
      return { status: response.status, body: text === '' ? {} : (JSON.parse(text) as Record<string, unknown>), etag: response.headers.get('etag') };
    },
  };
}
