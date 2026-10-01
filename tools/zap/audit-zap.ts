/**
 * Audit DAST OWASP ZAP avant chaque livraison (RI-SEC-15, ADR-0010).
 *
 * - Sans argument : démarre une pile locale éphémère (`docker compose -p pvzap`), l'analyse puis l'arrête.
 * - `--cible <url> [--reseau <réseau Docker>]` : analyse une application déjà démarrée (CI, recette).
 * - `--actif` : analyse active (attaques simulées), autorisée uniquement sur un réseau Docker éphémère.
 * Chaque alerte non justifiée dans `.zap/regles.tsv` fait échouer l'audit. Outillage. Règles : RI-SEC-15,
 * RI-RGS-03, RI-SEC-09.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Image officielle épinglée par empreinte (ZAP 2.17.0). */
export const ZAP_IMAGE = 'ghcr.io/zaproxy/zaproxy@sha256:781a2bdaea47324e7bab583e2263f21d257b0aee61ed51521a5be45f5f5081ef';
const LOCAL_PROJECT = 'pvzap';
// eslint-disable-next-line sonarjs/no-clear-text-protocols -- pile Docker éphémère sur un réseau interne, sans TLS
const LOCAL_TARGET = 'http://pv-app:8080';
const WORK_DIR = '.zap';
const REPORT = 'rapports/rapport-zap.json';

/** Options de l'audit. */
export interface ZapOptions {
  readonly target: string | undefined;
  readonly network: string | undefined;
  readonly active: boolean;
}

/** Alerte du rapport JSON de ZAP. */
interface ZapAlert {
  readonly pluginid: string;
  readonly name: string;
  readonly riskdesc: string;
  readonly instances: readonly { readonly uri: string; readonly param?: string }[];
}

/** Justifications des règles ignorées et des faux positifs par paramètre. */
export interface Justifications {
  readonly ignored: ReadonlySet<string>;
  readonly allowedParams: ReadonlySet<string>;
}

/**
 * Lit les options de la ligne de commande.
 * @param argv arguments (sans `node` ni le script)
 * @returns options
 */
export function parseOptions(argv: readonly string[]): ZapOptions {
  const valueOf = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  return { target: valueOf('--cible'), network: valueOf('--reseau'), active: argv.includes('--actif') };
}

/**
 * Construit les arguments de `docker run` pour ZAP ; refuse une analyse active hors réseau éphémère.
 * @param options options de l'audit
 * @param workDir dossier de travail monté dans le conteneur
 * @returns arguments
 * @throws Error si une analyse active vise une adresse hors réseau Docker
 */
export function zapArguments(options: ZapOptions, workDir: string): string[] {
  if (options.active && options.network === undefined) {
    throw new Error('Analyse active refusée : elle ne vise que des piles éphémères sur un réseau Docker, jamais la recette.');
  }
  const network = options.network === undefined ? [] : ['--network', options.network];
  const script = options.active ? 'zap-full-scan.py' : 'zap-baseline.py';
  const target = options.target ?? LOCAL_TARGET;
  const duration = options.active ? ['-T', '45'] : [];
  return ['run', '--rm', ...network, '-v', `${workDir}:/zap/wrk:rw`, ZAP_IMAGE, script, '-t', target, '-j', '-m', '2', ...duration, '-c', 'regles.tsv', '-J', REPORT, '-I'];
}

/**
 * Découpe un fichier TSV en lignes utiles (sans commentaires ni lignes vides).
 * @param tsv contenu
 * @returns cellules de chaque ligne
 */
function rows(tsv: string): string[][] {
  return tsv
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.startsWith('#'))
    .map((line) => line.split('\t'));
}

/**
 * Lit les justifications : règles ignorées (`.zap/regles.tsv`) et faux positifs par paramètre (`.zap/faux-positifs.tsv`).
 * @param rules contenu de `regles.tsv`
 * @param falsePositives contenu de `faux-positifs.tsv`
 * @returns justifications
 */
export function justifications(rules: string, falsePositives: string): Justifications {
  const ignored = new Set(
    rows(rules)
      .filter((cells) => cells[1] === 'IGNORE')
      .map((cells) => cells[0] ?? ''),
  );
  const allowedParams = new Set(rows(falsePositives).map((cells) => `${cells[0] ?? ''}\t${cells[1] ?? ''}`));
  return { ignored, allowedParams };
}

/**
 * Retient les alertes non justifiées (règle non ignorée et au moins une occurrence hors faux positifs) et les met en forme.
 * @param alerts alertes du rapport
 * @param justified justifications
 * @returns lignes de constats
 */
export function findings(alerts: readonly ZapAlert[], justified: Justifications): string[] {
  return alerts
    .filter((alert) => !justified.ignored.has(alert.pluginid))
    .map((alert) => ({ alert, open: alert.instances.filter((instance) => !justified.allowedParams.has(`${alert.pluginid}\t${instance.param ?? ''}`)) }))
    .filter(({ open }) => open.length > 0)
    .map(({ alert, open }) => `constat  ${alert.riskdesc}  [${alert.pluginid}] ${alert.name}  (${String(open.length)} occurrence(s), ex. ${open[0]?.uri ?? '?'} ${open[0]?.param ?? ''})`);
}

/**
 * Exécute une commande Docker et renvoie son code de sortie.
 * @param args arguments de `docker`
 * @returns code de sortie
 */
function docker(args: readonly string[]): number {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- outil de poste et de CI : Docker est résolu depuis le `PATH` de l'environnement de développement
  return spawnSync('docker', args, { stdio: 'inherit' }).status ?? 1;
}

/**
 * Démarre ou arrête la pile locale éphémère (cookies non sécurisés : HTTP local, sans TLS).
 * @param up vrai pour démarrer, faux pour arrêter et supprimer ses volumes
 * @returns code de sortie
 */
function localStack(up: boolean): number {
  const base = ['compose', '-p', LOCAL_PROJECT, '-f', join('deploy', 'compose', 'compose.yaml')];
  if (!up) return docker([...base, 'down', '-v']);
  process.env['PV_APP_SECURE_COOKIES'] = 'false';
  process.env['PV_APP_HTTPS'] = 'false';
  return docker([...base, 'up', '-d', '--build', '--wait']);
}

/**
 * Lance ZAP puis analyse son rapport.
 * @param options options de l'audit
 * @returns code de sortie de l'audit (0 : aucun constat)
 */
function scan(options: ZapOptions): number {
  const workDir = join(process.cwd(), WORK_DIR);
  mkdirSync(join(workDir, 'rapports'), { recursive: true });
  chmodSync(join(workDir, 'rapports'), 0o777);
  docker(zapArguments(options, workDir));
  const reportPath = join(workDir, REPORT);
  if (!existsSync(reportPath)) {
    process.stderr.write('Audit ZAP impossible : aucun rapport produit.\n');
    return 2;
  }
  const report = JSON.parse(readFileSync(reportPath, 'utf8')) as { readonly site: readonly { readonly alerts: readonly ZapAlert[] }[] };
  const read = (file: string): string => (existsSync(join(workDir, file)) ? readFileSync(join(workDir, file), 'utf8') : '');
  const lines = findings(
    report.site.flatMap((site) => site.alerts),
    justifications(read('regles.tsv'), read('faux-positifs.tsv')),
  );
  const summary = `Bilan ZAP : ${String(lines.length)} constat(s). Rapport : ${join(WORK_DIR, REPORT)}`;
  process.stdout.write([...lines, summary, ''].join('\n'));
  return lines.length === 0 ? 0 : 1;
}

if (import.meta.main) {
  const options = parseOptions(process.argv.slice(2));
  const local = options.target === undefined;
  if (local && localStack(true) !== 0) process.exit(2);
  const status = scan(local ? { ...options, network: `${LOCAL_PROJECT}_default` } : options);
  if (local) localStack(false);
  process.exitCode = status;
}
