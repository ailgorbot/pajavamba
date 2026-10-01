/**
 * Adoption progressive de Prettier (ADR-0009) : vérifie le formatage des seuls fichiers de code ajoutés ou
 * modifiés par rapport à une référence (par défaut `origin/main`).
 *
 * Usage : `node tools/ci/format-modifies.ts [référence] [--write]`. Outillage. Règles : §19.2, RI-COD-03.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Extensions formatées par Prettier dans cette phase d'adoption. */
export const FORMATTED_EXTENSIONS = ['.ts', '.tsx', '.mjs', '.cjs', '.js'] as const;

/**
 * Retient les fichiers de code à formater parmi une liste de chemins.
 * @param paths chemins renvoyés par `git diff --name-only`
 * @returns chemins à vérifier
 */
export function formattable(paths: readonly string[]): string[] {
  return paths.filter((path) => path !== '' && !path.startsWith('vault de développement/') && FORMATTED_EXTENSIONS.some((extension) => path.endsWith(extension)));
}

/**
 * Exécute un programme Node du dépôt avec l'exécutable Node courant (aucune résolution par le `PATH`).
 * @param args script et arguments
 * @returns code de sortie et sortie standard
 */
function runNode(args: readonly string[]): { readonly status: number; readonly stdout: string } {
  const run = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  // Prettier signale les fichiers mal formatés sur la sortie d'erreur : elle est reportée telle quelle.
  process.stderr.write(run.stderr);
  return { status: run.status ?? 1, stdout: run.stdout };
}

/**
 * Liste les fichiers ajoutés, copiés, modifiés ou renommés depuis la référence.
 * @param reference branche ou commit de comparaison
 * @returns chemins relatifs
 */
function changedFiles(reference: string): string[] {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- outil de poste et de CI : Git est résolu depuis le `PATH` de l'environnement de développement
  const run = spawnSync('git', ['-c', 'core.quotePath=false', 'diff', '--name-only', '--diff-filter=ACMR', `${reference}...HEAD`], { encoding: 'utf8' });
  return run.stdout.split('\n').map((line) => line.trim());
}

if (import.meta.main) {
  const write = process.argv.includes('--write');
  const reference = process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? 'origin/main';
  const files = formattable(changedFiles(reference)).filter((path) => existsSync(path));
  if (files.length === 0) {
    process.stdout.write('Aucun fichier de code modifié à formater.\n');
  } else {
    const result = runNode([join('node_modules', 'prettier', 'bin', 'prettier.cjs'), write ? '--write' : '--check', ...files]);
    process.stdout.write(result.stdout);
    process.exitCode = result.status;
  }
}
