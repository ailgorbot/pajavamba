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
