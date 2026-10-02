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
  host: z.string().default('127.0.0.1').meta({ description: 'Adresse d’écoute HTTP' }),
  port: z.coerce.number().int().min(1024).max(65_535).default(8080).meta({ description: 'Port d’écoute HTTP' }),
  dbHost: z.string().min(1).default('127.0.0.1').meta({ description: 'Hôte PostgreSQL' }),
  dbPort: z.coerce.number().int().default(5432).meta({ description: 'Port PostgreSQL' }),
  dbName: z.string().min(1).default('pajavamba').meta({ description: 'Base PostgreSQL' }),
  dbUser: z.string().min(1).default('pv_runtime').meta({ description: 'Rôle PostgreSQL d’exécution (sans `BYPASSRLS`)' }),
  dbPassword: z.string().min(16).meta({ description: 'Mot de passe du rôle d’exécution', secret: true }),
  dbPoolMax: z.coerce.number().int().min(2).max(100).default(20).meta({ description: 'Connexions PostgreSQL maximales du pool (RI-PRF-04)' }),
  pepper: z.string().min(32).meta({ description: 'Poivre HMAC des jetons et clés API', secret: true }),
  setupCode: z.string().min(16).meta({ description: 'Code d’initialisation de l’instance', secret: true }),
  fieldKey: z.string().min(32).meta({ description: 'Clé de chiffrement des champs sensibles (AES-256-GCM)', secret: true }),
  secureCookies: flag.default(true).meta({ description: 'Cookie de session `__Host-` sécurisé (HTTPS obligatoire)' }),
  https: flag.default(true).meta({ description: 'Service derrière HTTPS : en-tête HSTS' }),
  trustedProxies: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item !== ''),
    )
    .meta({ description: 'Proxys de confiance pour `X-Forwarded-For` (liste séparée par des virgules)' }),
  webDir: z.string().default('').meta({ description: 'Répertoire de l’interface compilée (vide : pas d’interface)' }),
  logDetail: z.enum(['functional', 'technical', 'debug']).default('technical').meta({ description: 'Niveau de détail du journal' }),
  purgeIntervalMinutes: z.coerce.number().int().min(1).default(60).meta({ description: 'Intervalle de la purge des projets supprimés (minutes)' }),
});

/** Configuration de l'unité. */
export type AppSettings = z.infer<typeof APP_SETTINGS>;

/** Schéma de configuration du migrateur. */
export const MIGRATE_SETTINGS = z.object({
  dbHost: z.string().min(1).default('127.0.0.1').meta({ description: 'Hôte PostgreSQL' }),
  dbPort: z.coerce.number().int().default(5432).meta({ description: 'Port PostgreSQL' }),
  dbName: z.string().min(1).default('pajavamba').meta({ description: 'Base PostgreSQL' }),
  dbAdminUser: z.string().min(1).default('postgres').meta({ description: 'Superutilisateur PostgreSQL du migrateur' }),
  dbAdminPassword: z.string().min(16).meta({ description: 'Mot de passe du superutilisateur', secret: true }),
  runtimePassword: z.string().min(16).meta({ description: 'Mot de passe attribué au rôle d’exécution', secret: true }),
});

/**
 * Chaîne de connexion PostgreSQL.
 * @param settings hôte, port, base, utilisateur, mot de passe
 * @returns chaîne de connexion
 */
export function connectionString(settings: { readonly dbHost: string; readonly dbPort: number; readonly dbName: string; readonly user: string; readonly password: string }): string {
  return `postgres://${encodeURIComponent(settings.user)}:${encodeURIComponent(settings.password)}@${settings.dbHost}:${String(settings.dbPort)}/${encodeURIComponent(settings.dbName)}`;
}
