/**
 * Politique de cache HTTP des fichiers de l'interface compilée (#279, constat ZAP 10049).
 *
 * Règles : RI-SEC-15 (constats DAST traités), RI-PRF (ressources versionnées mises en cache).
 */
import { sep } from 'node:path';

/** Fichiers dont le nom contient l'empreinte du contenu : jamais modifiés, mis en cache un an. */
export const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
/** Point d'entrée de l'application : toujours revalidé pour prendre la dernière version. */
export const ENTRY_CACHE = 'no-cache';
/** Autres fichiers publics (icônes, robots.txt) : un jour. */
export const PUBLIC_CACHE = 'public, max-age=86400';

/**
 * Choisit l'en-tête `cache-control` d'un fichier servi.
 * @param path chemin du fichier sur le disque
 * @returns valeur de `cache-control`
 */
export function cacheControlFor(path: string): string {
  const normalized = path.split(sep).join('/');
  if (normalized.includes('/assets/')) return IMMUTABLE_CACHE;
  if (normalized.endsWith('/index.html') || normalized === 'index.html') return ENTRY_CACHE;
  return PUBLIC_CACHE;
}
