/**
 * Accès PostgreSQL : pool plafonné, transactions portant le rôle du service et le contexte RLS.
 *
 * Couche : haute (OPS). Règles : RI-DON-01 (rôle d'exécution par service), RI-DON-02 (RLS forcée
 * via `app.organisation_id`), RI-COD-09 (SQL paramétré uniquement), RI-PRF-04 (pool plafonné).
 */
import pg from 'pg';

/** Exécuteur de requêtes paramétrées. */
export interface SqlExecutor {
  /**
   * Exécute une requête paramétrée et retourne ses lignes.
   * @param text requête SQL avec paramètres `$n`
   * @param params valeurs des paramètres
   */
  query<R extends object>(text: string, params?: readonly unknown[]): Promise<R[]>;
}

/** Portée d'une transaction : schéma et rôle PostgreSQL du service, contexte RLS. */
export interface TransactionScope {
  readonly schema: string;
  readonly role: string;
  readonly organisationId?: string;
  readonly actorId?: string;
  /** Annule la transaction en fin de traitement (simulation `dryRun`). */
  readonly rollback?: boolean;
}

// Les identifiants (rôle, schéma) ne peuvent pas être paramétrés en SQL : ils sont
// contrôlés par motif strict et proviennent exclusivement de constantes des services.
const ROLE_PATTERN = /^pv_[a-z_]+$/u;
const SCHEMA_PATTERN = /^[a-z][a-z_]{1,40}$/u;

/**
 * Crée un pool de connexions plafonné.
 * @param connectionString chaîne de connexion
 * @param max nombre maximal de connexions
 * @returns pool
 */
export function createPool(connectionString: string, max: number): pg.Pool {
  return new pg.Pool({ connectionString, max, idleTimeoutMillis: 30_000 });
}

/**
 * Adapte un client `pg` à l'interface `SqlExecutor`.
 * @param client client ou pool
 * @returns exécuteur
 */
export function executorOf(client: pg.Pool | pg.PoolClient): SqlExecutor {
  return {
    async query<R extends object>(text: string, params: readonly unknown[] = []): Promise<R[]> {
      const result = await client.query<R>(text, [...params]);
      return result.rows;
    },
  };
}

/**
 * Exécute un traitement dans une transaction sous le rôle du service, avec le contexte RLS.
 * @param pool pool de connexions
 * @param scope rôle et contexte
 * @param work traitement transactionnel
 * @returns valeur produite par le traitement
 */
export async function withTransaction<T>(pool: pg.Pool, scope: TransactionScope, work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  if (!ROLE_PATTERN.test(scope.role) || !SCHEMA_PATTERN.test(scope.schema)) {
    throw new Error('Rôle ou schéma PostgreSQL invalide');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${scope.role}`);
    await client.query(`SET LOCAL search_path TO ${scope.schema}, public`);
    await client.query("SELECT set_config('app.organisation_id', $1, true), set_config('app.actor_id', $2, true)", [scope.organisationId ?? '', scope.actorId ?? '']);
    const value = await work(executorOf(client));
    await client.query(scope.rollback === true ? 'ROLLBACK' : 'COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
