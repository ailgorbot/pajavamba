/**
 * Audit Semgrep complet avant chaque livraison : règles du projet et jeux de règles officiels, dans
 * l'image Semgrep épinglée. Affiche les constats et les erreurs d'analyse ; échoue s'il en reste.
 *
 * Usage : `node tools/semgrep/audit-semgrep.ts` (Docker requis). Outillage. Règles : RI-SEC-14
 * (audit à chaque livraison), RI-SEC-09, H10 (Semgrep en conteneur).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/** Image officielle épinglée par empreinte (même version que `security.yml`). */
export const SEMGREP_IMAGE = 'semgrep/semgrep:1.178.0@sha256:32e459968daabe7ab86968184a29109b9564aa00392401156f9788452b42786b';

/** Jeux de règles officiels appliqués en plus des règles du projet. */
export const REGISTRY_RULESETS = ['p/typescript', 'p/javascript', 'p/nodejs', 'p/react', 'p/owasp-top-ten', 'p/sql-injection', 'p/secrets', 'p/dockerfile', 'p/github-actions'] as const;

/** Dossiers exclus : cas de test volontairement fautifs et mémoire des agents. */
export const EXCLUDED = ['.semgrep', 'vault de développement'] as const;

interface SemgrepReport {
  readonly results: readonly { readonly check_id: string; readonly path: string; readonly start: { readonly line: number }; readonly extra: { readonly severity: string } }[];
  readonly errors: readonly { readonly message?: string; readonly path?: string }[];
}

/**
 * Construit les arguments de `docker run` pour l'audit du dépôt.
 * @param root racine du dépôt sur l'hôte
 * @param projectRules vrai si les règles du projet existent
 * @returns arguments
 */
export function dockerArguments(root: string, projectRules: boolean): string[] {
  const configs = [...(projectRules ? ['.semgrep/regles-projet.yml'] : []), ...REGISTRY_RULESETS].flatMap((config) => ['--config', config]);
  const exclusions = EXCLUDED.flatMap((path) => ['--exclude', path]);
  return ['run', '--rm', '-v', `${root}:/src`, '-w', '/src', SEMGREP_IMAGE, 'semgrep', 'scan', '--metrics=off', '--json', ...configs, ...exclusions, '.'];
}

/**
 * Met en forme le rapport pour la console.
 * @param report rapport JSON de Semgrep
 * @returns lignes lisibles
 */
export function summarize(report: SemgrepReport): string[] {
  const findings = report.results.map((result) => `constat  ${result.extra.severity.padEnd(8)} ${result.check_id.split('.').at(-1) ?? result.check_id}  ${result.path}:${String(result.start.line)}`);
  const errors = report.errors.map((error) => `erreur   ${error.path ?? '?'}  ${(error.message ?? '').split('\n')[0] ?? ''}`);
  return [...findings, ...errors, `Bilan : ${String(report.results.length)} constat(s), ${String(report.errors.length)} erreur(s) d'analyse.`];
}

if (import.meta.main) {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- outil de poste et de CI : Docker est résolu depuis le `PATH` de l'environnement de développement, jamais en production
  const run = spawnSync('docker', dockerArguments(process.cwd(), existsSync('.semgrep/regles-projet.yml')), { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (run.status === null || run.stdout === '') {
    process.stderr.write(`Audit impossible (Docker disponible ?) : ${run.stderr}\n`);
    process.exit(2);
  }
  const report = JSON.parse(run.stdout) as SemgrepReport;
  process.stdout.write(`${summarize(report).join('\n')}\n`);
  process.exitCode = report.results.length + report.errors.length === 0 ? 0 : 1;
}
