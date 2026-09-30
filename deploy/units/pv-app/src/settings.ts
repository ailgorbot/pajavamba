/**
 * Configuration de l'unité de déploiement `pv-app` (regroupement des services du MVP).
 *
 * Règles : RI-NOM-08 (`PV_APP_*`, secrets `_FILE`), RI-SCR-01 (aucun secret en variable
 * d'environnement), RI-VER-07 (écoute sur 127.0.0.1 par défaut), RI-SRV-09 (regroupement = configuration).
 */
import { z } from 'zod';

const flag = z.enum(['true', 'false']).transform((value) => value === 'true');

/** Schéma de configuration de l'unité. */
export const APP_SETTINGS = z.object({
  host: z.string().default('127.0.0.1'),
  port: z.coerce.number().int().min(1024).max(65_535).default(8080),
  dbHost: z.string().min(1).default('127.0.0.1'),
  dbPort: z.coerce.number().int().default(5432),
  dbName: z.string().min(1).default('pajavamba'),
  dbUser: z.string().min(1).default('pv_runtime'),
  dbPassword: z.string().min(16),
  dbPoolMax: z.coerce.number().int().min(2).max(100).default(20),
  pepper: z.string().min(32),
  setupCode: z.string().min(16),
  fieldKey: z.string().min(32),
  secureCookies: flag.default(true),
  https: flag.default(true),
  trustedProxies: z.string().default('').transform((value) => value.split(',').map((item) => item.trim()).filter((item) => item !== '')),
  webDir: z.string().default(''),
  logDetail: z.enum(['functional', 'technical', 'debug']).default('technical'),
  purgeIntervalMinutes: z.coerce.number().int().min(1).default(60),
});

/** Configuration de l'unité. */
export type AppSettings = z.infer<typeof APP_SETTINGS>;

/** Schéma de configuration du migrateur. */
export const MIGRATE_SETTINGS = z.object({
  dbHost: z.string().min(1).default('127.0.0.1'),
  dbPort: z.coerce.number().int().default(5432),
  dbName: z.string().min(1).default('pajavamba'),
  dbAdminUser: z.string().min(1).default('postgres'),
  dbAdminPassword: z.string().min(16),
  runtimePassword: z.string().min(16),
});

/**
 * Chaîne de connexion PostgreSQL.
 * @param settings hôte, port, base, utilisateur, mot de passe
 * @returns chaîne de connexion
 */
export function connectionString(settings: { readonly dbHost: string; readonly dbPort: number; readonly dbName: string; readonly user: string; readonly password: string }): string {
  return `postgres://${encodeURIComponent(settings.user)}:${encodeURIComponent(settings.password)}@${settings.dbHost}:${String(settings.dbPort)}/${encodeURIComponent(settings.dbName)}`;
}
