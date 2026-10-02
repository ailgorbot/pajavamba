/**
 * Génère depuis le code les références des erreurs, du journal et de la configuration (`docs/reference/`) ; la CI
 * échoue si un fichier commité diffère (`--check`).
 *
 * Outillage. Règles : RI-DOC-03 (référence générée, jamais écrite à la main), RI-NOM-08 (variables `PV_*`,
 * secrets `_FILE`), RI-LOG (catalogue de journalisation), §21.5.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { APP_SETTINGS, MIGRATE_SETTINGS } from '../../deploy/units/pv-app/src/settings.ts';
import { STATUS_BY_KIND } from '../../packages/ops/src/domain-problem.ts';
import { LOG_CATALOG, LOG_CATALOG_VERSION } from '../../packages/ops/src/log-catalog.ts';
import { renderTraces, traceRules, untestedDeclaredRules } from './tracabilite.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const OUTPUT = join(ROOT, 'docs', 'reference');
const SOURCE_ROOTS = ['packages', 'services', 'deploy'];
const DOMAIN_ERROR = /domainError\(\s*'(?<code>[^']+)',\s*'(?<kind>[a-z_]+)',\s*(?<quote>['"])(?<message>.*?)\k<quote>/gsu;
const HTTP_PROBLEM = /status:\s*(?<status>\d{3}),\s*code:\s*'(?<code>[^']+)',\s*title:\s*(?<quote>['"])(?<message>.*?)\k<quote>/gsu;

interface ErrorEntry {
  readonly code: string;
  readonly status: number;
  readonly message: string;
  readonly origins: Set<string>;
}

/**
 * En-tête commun des documents générés.
 * @param title titre
 * @param source source du document
 * @returns lignes
 */
function header(title: string, source: string): string[] {
  return [
    '---',
    `titre: ${title}`,
    'public: développeurs, exploitants',
    'statut: généré',
    'version_min: 0.4.0',
    '---',
    '',
    `# ${title}`,
    '',
    `> Document **généré** par \`tools/reference/generate-catalogs.ts\` depuis ${source} (RI-DOC-03). Ne pas modifier à la main.`,
    '',
  ];
}

/**
 * Liste récursivement les fichiers TypeScript de code livré (hors tests et dépendances).
 * @param dir dossier
 * @returns chemins
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return ['node_modules', 'tests', 'dist'].includes(entry.name) ? [] : sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

/**
 * Nom du service ou du paquet d'un fichier source.
 * @param path chemin
 * @returns origine lisible
 */
function originOf(path: string): string {
  const parts = relative(ROOT, path).split(sep);
  return parts[0] === 'deploy' ? (parts[2] ?? 'deploy') : (parts[1] ?? parts[0] ?? '?');
}

/**
 * Relève les erreurs déclarées (`domainError(…)` et problèmes HTTP) dans le code livré.
 * @returns erreurs triées par code
 */
function collectErrors(): ErrorEntry[] {
  const entries = new Map<string, ErrorEntry>();
  const record = (found: { readonly code: string; readonly status: number; readonly message: string }, origin: string): void => {
    const entry = entries.get(found.code) ?? { ...found, origins: new Set<string>() };
    entry.origins.add(origin);
    entries.set(found.code, entry);
  };
  for (const file of SOURCE_ROOTS.flatMap((root) => sourceFiles(join(ROOT, root)))) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(DOMAIN_ERROR)) {
      const groups = match.groups ?? {};
      record({ code: groups['code'] ?? '', status: STATUS_BY_KIND[groups['kind'] as keyof typeof STATUS_BY_KIND], message: groups['message'] ?? '' }, originOf(file));
    }
    for (const match of text.matchAll(HTTP_PROBLEM)) {
      const groups = match.groups ?? {};
      record({ code: groups['code'] ?? '', status: Number(groups['status']), message: groups['message'] ?? '' }, originOf(file));
    }
  }
  return [...entries.values()].sort((left, right) => left.code.localeCompare(right.code));
}

/**
 * Échappe une cellule de tableau Markdown.
 * @param text texte
 * @returns texte sûr
 */
function cell(text: string): string {
  return text.replaceAll('|', '\\|');
}

/**
 * Référence des erreurs.
 * @returns contenu
 */
function renderErrors(): string {
  const errors = collectErrors();
  const rows = errors.map((error) => `| \`${error.code}\` | ${String(error.status)} | ${cell(error.message)} | ${[...error.origins].sort((left, right) => left.localeCompare(right)).join(', ')} |`);
  return [
    ...header('Référence des erreurs', 'les erreurs métier (`domainError`) et les problèmes HTTP déclarés dans le code'),
    `Toutes les erreurs sont renvoyées au format RFC 9457 (\`application/problem+json\`), avec le code stable ci-dessous. Nombre de codes : ${String(errors.length)}.`,
    '',
    '| Code | Statut HTTP | Message ou titre | Origine |',
    '|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}

/**
 * Référence du catalogue de journalisation.
 * @returns contenu
 */
function renderJournal(): string {
  const rows = Object.entries(LOG_CATALOG).map(([key, entry]) => `| \`${entry.code}\` | \`${entry.severity}\` | \`${entry.detail}\` | ${cell(entry.message)} | \`${key}\` |`);
  return [
    ...header('Catalogue de journalisation', 'le catalogue de `packages/ops`'),
    `Version du catalogue : ${LOG_CATALOG_VERSION} (portée par chaque entrée émise). Le niveau de détail (\`PV_APP_LOG_DETAIL\`) filtre les entrées : \`functional\` < \`technical\` < \`debug\`.`,
    '',
    '| Code | Sévérité | Détail | Message | Clé |',
    '|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}

interface SchemaField {
  readonly meta: () => Record<string, unknown> | undefined;
  readonly _zod: { readonly def: { readonly type: string; readonly defaultValue?: unknown; readonly in?: SchemaField } };
}

/**
 * Valeur par défaut d'un champ (en traversant les transformations).
 * @param field champ Zod
 * @returns valeur affichable
 */
function defaultOf(field: SchemaField): string {
  const def = field._zod.def;
  if (def.type === 'default') return def.defaultValue === '' ? '(vide)' : `\`${String(def.defaultValue)}\``;
  return def.type === 'pipe' && def.in !== undefined ? defaultOf(def.in) : '— (obligatoire)';
}

/**
 * Lignes de configuration d'un schéma.
 * @param prefix préfixe des variables
 * @param schema schéma Zod objet
 * @returns lignes de tableau
 */
function configRows(prefix: string, schema: { readonly shape: Readonly<Record<string, unknown>> }): string[] {
  return Object.entries(schema.shape).map(([key, value]) => {
    const field = value as SchemaField;
    const meta = field.meta() ?? {};
    const suffix = key.replaceAll(/[A-Z]/gu, (letter) => '_' + letter).toUpperCase();
    const name = `PV_${prefix}_${suffix}`;
    const secret = meta['secret'] === true;
    const variable = secret ? `\`${name}_FILE\` (secret en fichier)` : `\`${name}\``;
    return `| ${variable} | ${defaultOf(field)} | ${cell(typeof meta['description'] === 'string' ? meta['description'] : '')} |`;
  });
}

/**
 * Référence de la configuration.
 * @returns contenu
 */
function renderConfiguration(): string {
  const table = ['| Variable | Défaut | Rôle |', '|---|---|---|'];
  return [
    ...header('Référence de la configuration', 'les schémas de configuration de `deploy/units/pv-app`'),
    'Toute variable peut être fournie en fichier par la variante `_FILE`, qui prévaut ; les secrets ne sont acceptés que sous cette forme en production (RI-SCR-01). Une configuration invalide arrête le service au démarrage en citant les seuls noms des variables fautives.',
    '',
    '## Unité `pv-app`',
    '',
    ...table,
    ...configRows('APP', APP_SETTINGS),
    '',
    '## Migrateur `pv-migrate`',
    '',
    ...table,
    ...configRows('MIGRATE', MIGRATE_SETTINGS),
    '',
  ].join('\n');
}

/**
 * Matrice de traçabilité des règles de gestion.
 * @returns contenu
 */
function renderTraceability(): string {
  return [...header('Matrice de traçabilité des règles', 'les identifiants `RG-…` cités dans le code et dans les tests'), ...renderTraces(traceRules(ROOT))].join('\n');
}

const DOCUMENTS: Readonly<Record<string, () => string>> = { 'erreurs.md': renderErrors, 'journal.md': renderJournal, 'configuration.md': renderConfiguration, 'tracabilite.md': renderTraceability };

const check = process.argv.includes('--check');
const untested = untestedDeclaredRules(traceRules(ROOT));
if (check && untested.length > 0) {
  console.error(`Règles déclarées dans fonctionnel/src/regles/ sans test : ${untested.join(', ')}.`);
  process.exitCode = 1;
}
for (const [file, render] of Object.entries(DOCUMENTS)) {
  const path = join(OUTPUT, file);
  const content = render();
  if (!check) writeFileSync(path, content);
  else if (readFileSync(path, 'utf8') !== content) {
    console.error(`La référence ${file} est désynchronisée : exécutez pnpm reference.`);
    process.exitCode = 1;
  }
}
