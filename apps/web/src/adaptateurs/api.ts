/**
 * Client de l'API publique : seul point d'accès réseau de l'interface.
 *
 * Couche : interface (adaptateurs). Règles : RI-API-02 (l'interface n'utilise que l'API publique),
 * RI-CNX-04 (jeton CSRF), RI-API-05 (Idempotency-Key, If-Match), RI-RGPD-05 (aucune donnée
 * personnelle en `localStorage` : le jeton CSRF reste en mémoire).
 */

/** Erreur RFC 9457 renvoyée par l'API. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string;
  readonly fieldErrors: readonly { readonly pointer: string; readonly message: string }[];

  /**
   * @param status statut HTTP
   * @param body corps RFC 9457
   */
  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body['detail'] === 'string' ? body['detail'] : 'Erreur inattendue.');
    this.status = status;
    this.code = typeof body['code'] === 'string' ? body['code'] : 'inconnu';
    this.title = typeof body['title'] === 'string' ? body['title'] : 'Erreur';
    this.detail = this.message;
    this.fieldErrors = Array.isArray(body['errors']) ? (body['errors'] as { readonly pointer: string; readonly message: string }[]) : [];
  }
}

let csrfToken: string | null = null;

/**
 * Mémorise le jeton CSRF de la session courante.
 * @param token jeton, ou `null` à la déconnexion
 */
export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

/** Options d'une requête. */
export interface RequestOptions {
  readonly body?: unknown;
  readonly ifMatch?: number;
}

/**
 * Appelle l'API ; lève `ApiError` pour toute réponse en erreur.
 * @param method méthode HTTP
 * @param path chemin sous `/api/v1`
 * @param options corps et version attendue
 * @returns corps de la réponse
 */
export async function api<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, options: RequestOptions = {}): Promise<T> {
  const init = { method, headers: headersFor(method, options), credentials: 'same-origin' as const, ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) };
  const response = await fetch(`/api/v1${path}`, init);
  const text = await response.text();
  const body: unknown = text === '' ? null : JSON.parse(text);
  if (!response.ok) {
    throw new ApiError(response.status, body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {});
  }
  return body as T;
}

/**
 * En-têtes d'une requête : CSRF sur les écritures, clé d'idempotence sur POST, version attendue.
 * @param method méthode HTTP
 * @param options corps et version attendue
 * @returns en-têtes
 */
function headersFor(method: string, options: RequestOptions): Record<string, string> {
  const headers: Record<string, string> = { accept: 'application/json', 'accept-language': 'fr-FR' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (method !== 'GET' && csrfToken !== null) headers['x-csrf-token'] = csrfToken;
  if (method === 'POST') headers['idempotency-key'] = crypto.randomUUID();
  if (options.ifMatch !== undefined) headers['if-match'] = `"${String(options.ifMatch)}"`;
  return headers;
}

/** Page de résultats. */
export interface Page<T> {
  readonly data: readonly T[];
}
