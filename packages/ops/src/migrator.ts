/**
 * Migrateur SQL versionné : verrou consultatif, table d'historique, sommes de contrôle.
 *
 * Couche : haute (OPS). Règles : RI-DON-04 (migrations vers l'avant, immuables après fusion), §5.1.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type pg from 'pg';
import type { Logger } from './logger.ts';
import { sha256Hex } from './secrets.ts';

/** Ensemble de migrations d'un service. */
export interface MigrationSet {
  readonly service: string;
  readonly directory: string;
}

const LOCK_KEY = 7_311_966;

const HISTORY_DDL = `
CREATE SCHEMA IF NOT EXISTS pv_ops;
CREATE TABLE IF NOT EXISTS pv_ops.schema_migrations (
  service text NOT NULL,
  name text NOT NULL,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_schema_migrations PRIMARY KEY (service, name)
);
COMMENT ON TABLE pv_ops.schema_migrations IS 'Historique des migrations appliquées par service';
`;

interface AppliedRow {
  readonly name: string;
  readonly checksum: string;
}

/** Migration à appliquer. */
interface PendingMigration {
  readonly set: MigrationSet;
  readonly file: string;
  readonly applied: ReadonlyMap<string, string>;
}

/**
 * Applique une migration si elle ne l'a pas déjà été ; échoue si une migration appliquée a changé.
 * @param client connexion d'administration
 * @param migration ensemble, fichier et migrations déjà appliquées
 * @returns vrai si la migration a été appliquée
 */
async function applyOne(client: pg.PoolClient, migration: PendingMigration): Promise<boolean> {
  const { set, file, applied } = migration;
  const sql = readFileSync(join(set.directory, file), 'utf8');
  const checksum = sha256Hex(sql);
  const previous = applied.get(file);
  if (previous !== undefined) {
    if (previous !== checksum) throw new Error(`Migration modifiée après application : ${set.service}/${file}`);
    return false;
  }
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO pv_ops.schema_migrations (service, name, checksum) VALUES ($1, $2, $3)', [set.service, file, checksum]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * Applique les migrations d'un service, dans l'ordre des noms de fichiers.
 * @param client connexion d'administration
 * @param set ensemble du service
 * @param logger journal catalogué
 */
async function applySet(client: pg.PoolClient, set: MigrationSet, logger: Logger): Promise<void> {
  const rows = await client.query<AppliedRow>('SELECT name, checksum FROM pv_ops.schema_migrations WHERE service = $1', [set.service]);
  const applied = new Map(rows.rows.map((row) => [row.name, row.checksum]));
  const files = readdirSync(set.directory).filter((name) => name.endsWith('.sql')).sort((left, right) => left.localeCompare(right));
  for (const file of files) {
    if (await applyOne(client, { set, file, applied })) logger.emit('migrationApplied', { service: set.service, migration: file });
  }
}

/**
 * Applique, dans l'ordre, les migrations de chaque service.
 * @param pool pool d'administration (rôle de migration)
 * @param sets ensembles de migrations, dans l'ordre d'application
 * @param logger journal catalogué
 */
export async function runMigrations(pool: pg.Pool, sets: readonly MigrationSet[], logger: Logger): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await client.query(HISTORY_DDL);
    for (const set of sets) await applySet(client, set, logger);
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
    client.release();
  }
}
