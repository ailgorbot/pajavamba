/**
 * Migrateur de l'unité : applique les migrations de tous les services, puis crée le rôle de
 * connexion d'exécution (sans `BYPASSRLS`, non superutilisateur) et lui accorde les rôles des services.
 *
 * Règles : RI-DON-01 (rôle d'exécution distinct du rôle de migration), RI-DON-04, RI-SCR-07
 * (mot de passe généré à l'installation), §7.2 (migrations avant les services).
 */
import { AUDIT_MIGRATIONS } from '@pajavamba/audit-structure';
import { EVENT_RELAY_MIGRATIONS } from '@pajavamba/event-relay-structure';
import { IDENTITY_MIGRATIONS } from '@pajavamba/identity-structure';
import { createLogger, createPool, loadConfig, runMigrations } from '@pajavamba/ops';
import { POLICY_MIGRATIONS } from '@pajavamba/policy-structure';
import { PORTFOLIO_MIGRATIONS } from '@pajavamba/portfolio-structure';
import { QUERY_MIGRATIONS } from '@pajavamba/query-structure';
import { WORKFLOW_MIGRATIONS } from '@pajavamba/workflow-structure';
import { WORKITEM_MIGRATIONS } from '@pajavamba/workitem-structure';
import { connectionString, MIGRATE_SETTINGS } from './settings.ts';

/** Rôles d'exécution des services accordés au rôle de connexion. */
export const SERVICE_ROLES = ['pv_event_relay_app', 'pv_identity_app', 'pv_policy_app', 'pv_portfolio_app', 'pv_workflow_app', 'pv_workitem_app', 'pv_query_app', 'pv_audit_app'];

/** Ensembles de migrations, dans l'ordre d'application (socle d'abord). */
export const MIGRATION_SETS = [EVENT_RELAY_MIGRATIONS, IDENTITY_MIGRATIONS, POLICY_MIGRATIONS, PORTFOLIO_MIGRATIONS, WORKFLOW_MIGRATIONS, WORKITEM_MIGRATIONS, QUERY_MIGRATIONS, AUDIT_MIGRATIONS];

const RUNTIME_ROLE_SQL = `
DO $$ BEGIN
  CREATE ROLE pv_runtime LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;`;

/**
 * Crée ou met à jour le rôle de connexion d'exécution.
 * @param pool pool d'administration
 * @param password mot de passe généré à l'installation
 */
async function ensureRuntimeRole(pool: ReturnType<typeof createPool>, password: string): Promise<void> {
  await pool.query(RUNTIME_ROLE_SQL);
  // format(%L) échappe la valeur côté serveur : aucune concaténation de chaîne dans le client.
  const statement = await pool.query<{ readonly sql: string }>("SELECT format('ALTER ROLE pv_runtime WITH LOGIN PASSWORD %L', $1::text) AS sql", [password]);
  await pool.query(statement.rows[0]?.sql ?? 'SELECT 1');
  await pool.query(`GRANT ${SERVICE_ROLES.join(', ')} TO pv_runtime`);
}

/**
 * Point d'entrée du migrateur.
 */
async function main(): Promise<void> {
  const logger = createLogger({ service: 'pv-migrate', detail: 'functional' });
  const settings = loadConfig('MIGRATE', MIGRATE_SETTINGS, process.env);
  const pool = createPool(connectionString({ ...settings, user: settings.dbAdminUser, password: settings.dbAdminPassword }), 2);
  try {
    await runMigrations(pool, MIGRATION_SETS, logger);
    await ensureRuntimeRole(pool, settings.runtimePassword);
  } finally {
    await pool.end();
  }
}

await main();
