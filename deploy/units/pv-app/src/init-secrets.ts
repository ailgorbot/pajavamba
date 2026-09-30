/**
 * Génère, à la première installation, les secrets de l'instance dans le répertoire de secrets :
 * aucun secret par défaut, aucun secret en variable d'environnement.
 *
 * Règles : RI-SCR-07, RI-SCR-09 (générateur cryptographiquement sûr), RI-SCR-01, §9.4.
 * Les fichiers existants ne sont jamais écrasés (une mise à jour ne remet rien à blanc, RI-DON-05).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLogger, randomSecret } from '@pajavamba/ops';

const SECRET_LENGTH = 48;
const SETUP_CODE_LENGTH = 24;
// Lisible par les seuls conteneurs qui montent le volume de secrets (base, migrateur, application).
const FILE_MODE = 0o644;

/** Secrets générés et leur longueur. */
export const INSTANCE_SECRETS: Readonly<Record<string, number>> = {
  db_admin_password: SECRET_LENGTH,
  db_runtime_password: SECRET_LENGTH,
  pepper: SECRET_LENGTH,
  field_key: SECRET_LENGTH,
  setup_code: SETUP_CODE_LENGTH,
};

/**
 * Crée les fichiers de secrets manquants.
 * @param directory répertoire des secrets
 * @returns noms des secrets créés
 */
export function initSecrets(directory: string): string[] {
  mkdirSync(directory, { recursive: true });
  const created: string[] = [];
  for (const [name, length] of Object.entries(INSTANCE_SECRETS)) {
    const path = join(directory, name);
    if (!existsSync(path)) {
      writeFileSync(path, randomSecret(length), { mode: FILE_MODE, flag: 'wx' });
      created.push(name);
    }
  }
  return created;
}

const logger = createLogger({ service: 'pv-init', detail: 'functional' });
const created = initSecrets(process.env['PV_INIT_SECRETS_DIR'] ?? '/secrets');
logger.emit('jobCompleted', { action: 'secrets.init', count: created.length });
