/**
 * Configuration validée au démarrage ; arrêt immédiat si elle est invalide.
 *
 * Couche : haute (OPS). Règles : RI-NOM-08 (`PV_<SERVICE>_<PARAMETRE>`, secrets `_FILE`),
 * RI-SCR-01 (aucun secret en variable d'environnement de production), §5.12.
 */
import { readFileSync } from 'node:fs';
import { z } from 'zod';

/** Source des variables d'environnement (injectée pour les tests). */
export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

/**
 * Convertit une clé `camelCase` en suffixe `UPPER_SNAKE_CASE`.
 * @param key clé du schéma
 * @returns suffixe de variable
 */
function toEnvSuffix(key: string): string {
  return key.replaceAll(/[A-Z]/gu, (letter) => `_${letter}`).toUpperCase();
}

/**
 * Lit une valeur brute : la variante `_FILE` (secret monté en fichier) prévaut.
 * @param env source des variables
 * @param name nom de la variable
 * @returns valeur lue ou `undefined`
 */
function readRaw(env: EnvironmentSource, name: string): string | undefined {
  const filePath = env[`${name}_FILE`];
  if (filePath !== undefined && filePath !== '') {
    return readFileSync(filePath, 'utf8').trim();
  }
  return env[name];
}

/**
 * Charge et valide la configuration d'un service.
 * Le message d'erreur ne cite que les noms des paramètres, jamais leurs valeurs.
 * @param prefix préfixe de service (`PV_<PREFIX>_…`)
 * @param schema schéma Zod objet de la configuration
 * @param env source des variables
 * @returns configuration typée
 */
export function loadConfig<S extends z.ZodObject>(
  prefix: string,
  schema: S,
  env: EnvironmentSource,
): z.infer<S> {
  const raw: Record<string, string | undefined> = {};
  for (const key of Object.keys(schema.shape)) {
    raw[key] = readRaw(env, `PV_${prefix}_${toEnvSuffix(key)}`);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => `PV_${prefix}_${toEnvSuffix(String(issue.path[0]))}`);
    throw new Error(`Configuration invalide : ${[...new Set(names)].join(', ')}`);
  }
  return parsed.data;
}
