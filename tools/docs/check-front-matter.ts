/**
 * Vérifie le front-matter de chaque page de `docs/` : `titre` et `public` toujours, `mise_a_jour` au format
 * AAAA-MM-JJ sauf pour les pages générées (`statut: généré`, régénérées depuis le code).
 *
 * Usage : `node tools/docs/check-front-matter.ts`. Outillage. Règles : RI-DOC-06 (front-matter obligatoire), §21.5.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const DATE = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * Lit le front-matter YAML simple (`clé: valeur`) d'une page.
 * @param text contenu Markdown
 * @returns champs, ou `undefined` sans front-matter
 */
export function frontMatter(text: string): ReadonlyMap<string, string> | undefined {
  const lines = text.split(/\r?\n/u);
  if (lines[0] !== '---') return undefined;
  const end = lines.indexOf('---', 1);
  if (end === -1) return undefined;
  const fields = new Map<string, string>();
  for (const line of lines.slice(1, end)) {
    const separator = line.indexOf(':');
    if (separator > 0) fields.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }
  return fields;
}

/**
 * Écarts du front-matter d'une page.
 * @param text contenu Markdown
 * @returns messages (vide si conforme)
 */
export function frontMatterProblems(text: string): string[] {
  const fields = frontMatter(text);
  if (fields === undefined) return ['front-matter absent'];
  const problems = ['titre', 'public'].filter((field) => (fields.get(field) ?? '') === '').map((field) => `champ « ${field} » manquant`);
  const generated = fields.get('statut') === 'généré';
  if (!generated && !DATE.test(fields.get('mise_a_jour') ?? '')) problems.push('champ « mise_a_jour » manquant ou hors format AAAA-MM-JJ');
  return problems;
}

/**
 * Pages Markdown de la documentation (hors fichiers publics et construits).
 * @param dir dossier
 * @returns chemins
 */
function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return ['public', 'node_modules'].includes(entry.name) || entry.name.startsWith('.') ? [] : pages(path);
    return entry.name.endsWith('.md') ? [path] : [];
  });
}

if (import.meta.main) {
  const root = join(import.meta.dirname, '..', '..');
  let failures = 0;
  for (const page of pages(join(root, 'docs'))) {
    for (const problem of frontMatterProblems(readFileSync(page, 'utf8'))) {
      console.error(`::error file=${relative(root, page)}::Front-matter non conforme (RI-DOC-06) : ${problem}.`);
      failures += 1;
    }
  }
  process.exitCode = failures === 0 ? 0 : 1;
}
