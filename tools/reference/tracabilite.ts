/**
 * Matrice de traçabilité des règles de gestion `RG-…` : où chaque règle est citée dans le code livré et quels
 * tests la référencent. Une règle déclarée dans `services/<s>/fonctionnel/src/regles/` sans test fait échouer
 * la génération en mode contrôle.
 *
 * Outillage. Règles : RI-COM-05 (toute règle implémentée cite son identifiant), RI-NOM-11, RI-DOC-03, §19.9.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const RULE = /RG-[A-Z]+-\d{3}/gu;
const DECLARATION_DIR = `${sep}fonctionnel${sep}src${sep}regles${sep}`;

/** Une règle et ses références. */
export interface RuleTrace {
  readonly rule: string;
  readonly code: ReadonlySet<string>;
  readonly tests: ReadonlySet<string>;
  readonly declared: boolean;
}

/**
 * Liste récursivement les fichiers TypeScript d'un dossier (hors dépendances).
 * @param dir dossier
 * @returns chemins
 */
function typescriptFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' || entry.name === 'dist' ? [] : typescriptFiles(path);
    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [path] : [];
  });
}

/**
 * Indique si un fichier est un test (unitaire, d'intégration ou de fumée).
 * @param path chemin relatif
 * @returns vrai pour un test
 */
function isTest(path: string): boolean {
  return path.includes(`${sep}tests${sep}`) || path.startsWith(`tools${sep}smoke${sep}`);
}

/**
 * Relève les règles citées dans le code et dans les tests.
 * @param root racine du dépôt
 * @returns règles triées
 */
export function traceRules(root: string): RuleTrace[] {
  const traces = new Map<string, { code: Set<string>; tests: Set<string>; declared: boolean }>();
  const files = ['packages', 'services', 'deploy', 'apps', join('tools', 'smoke')].flatMap((dir) => typescriptFiles(join(root, dir)));
  for (const file of files) {
    const path = relative(root, file);
    for (const rule of new Set(readFileSync(file, 'utf8').match(RULE) ?? [])) {
      const trace = traces.get(rule) ?? { code: new Set<string>(), tests: new Set<string>(), declared: false };
      (isTest(path) ? trace.tests : trace.code).add(path.split(sep).join('/'));
      trace.declared ||= path.includes(DECLARATION_DIR);
      traces.set(rule, trace);
    }
  }
  return [...traces.entries()].map(([rule, trace]) => ({ rule, ...trace })).sort((left, right) => left.rule.localeCompare(right.rule));
}

/**
 * Règles déclarées dans `fonctionnel/src/regles/` sans aucun test.
 * @param traces matrice
 * @returns identifiants en défaut
 */
export function untestedDeclaredRules(traces: readonly RuleTrace[]): string[] {
  return traces.filter((trace) => trace.declared && trace.tests.size === 0).map((trace) => trace.rule);
}

/**
 * Matrice de traçabilité au format Markdown (sans en-tête de document).
 * @param traces matrice
 * @returns lignes
 */
export function renderTraces(traces: readonly RuleTrace[]): string[] {
  const tested = traces.filter((trace) => trace.tests.size > 0).length;
  const list = (paths: ReadonlySet<string>): string => [...paths].map((path) => `\`${path}\``).join('<br>') || '—';
  const rows = traces.map((trace) => `| ${trace.rule} | ${trace.tests.size > 0 ? 'oui' : '**non**'} | ${list(trace.code)} | ${list(trace.tests)} |`);
  return [
    `Règles citées : ${String(traces.length)} ; règles couvertes par au moins un test : ${String(tested)}. Une règle déclarée dans \`services/<s>/fonctionnel/src/regles/\` doit être référencée par un test, sinon \`pnpm reference:check\` échoue.`,
    '',
    '| Règle | Testée | Code | Tests |',
    '|---|---|---|---|',
    ...rows,
    '',
  ];
}
