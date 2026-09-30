/**
 * Tests de fumée du parcours MVP : initialisation (si nécessaire), connexion, projet, éléments,
 * transitions, backlog, board, recherche, contrôles de sécurité.
 *
 * Outillage (hors produit), exécuté après chaque déploiement (§7.2, étape 6).
 * Usage : node tools/smoke/smoke-test.ts <url> <fichier du code d'initialisation | ->
 * Variables : PV_SMOKE_EMAIL et PV_SMOKE_PASSWORD_FILE pour réutiliser un compte existant.
 */
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createApiClient, type ApiClient } from './api-client.ts';

const [baseUrl = 'http://127.0.0.1:8080', setupCodeFile = '-'] = process.argv.slice(2);
const WAIT_MS = 250;
const MAX_WAIT_STEPS = 40;
let failures = 0;

/**
 * Vérifie une condition et affiche le résultat.
 * @param label libellé du contrôle
 * @param condition résultat
 * @param detail détail en cas d'échec
 */
function check(label: string, condition: boolean, detail: unknown = ''): void {
  console.log(`${condition ? 'OK ' : 'KO '} ${label}${condition ? '' : ` → ${JSON.stringify(detail)}`}`);
  if (!condition) failures += 1;
}

/**
 * Attend qu'une condition asynchrone soit vraie (projections asynchrones).
 * @param probe sonde
 * @returns vrai si la condition est remplie à temps
 */
async function eventually(probe: () => Promise<boolean>): Promise<boolean> {
  for (let step = 0; step < MAX_WAIT_STEPS; step += 1) {
    if (await probe()) return true;
    await new Promise((resolve) => setTimeout(resolve, WAIT_MS));
  }
  return false;
}

/**
 * Initialise l'instance si nécessaire puis ouvre une session.
 * @param api client
 * @returns vrai si la session est ouverte
 */
async function login(api: ApiClient): Promise<boolean> {
  const status = await api.call('GET', '/setup');
  const email = process.env['PV_SMOKE_EMAIL'] ?? 'proprietaire.recette@example.org';
  const passwordFile = process.env['PV_SMOKE_PASSWORD_FILE'];
  const password = passwordFile === undefined ? `Recette-${randomBytes(9).toString('base64url')}` : readFileSync(passwordFile, 'utf8').trim();
  if (status.body['initialized'] === false && setupCodeFile !== '-') {
    const setup = await api.call('POST', '/setup', { setupCode: readFileSync(setupCodeFile, 'utf8').trim(), organisationName: 'Organisation de recette', organisationSlug: 'recette', email, displayName: 'Propriétaire de recette', password });
    check('initialisation de l’instance', setup.status === 201, setup.body);
  }
  const session = await api.call('POST', '/sessions', { email, password });
  check('connexion avec un compte local', session.status === 201, session.body);
  if (typeof session.body['csrfToken'] === 'string') api.setCsrf(session.body['csrfToken']);
  return session.status === 201;
}

/**
 * Contrôles de sécurité de base.
 * @param anonymous client sans session
 */
async function securityChecks(anonymous: ApiClient): Promise<void> {
  check('santé /healthz', (await fetch(`${baseUrl}/healthz`)).status === 200);
  check('disponibilité /readyz', (await fetch(`${baseUrl}/readyz`)).status === 200);
  check('API refusée sans authentification (401)', (await anonymous.call('GET', '/projects')).status === 401);
  const leaked = await fetch(`${baseUrl}/api/v1/projects?token=pvb_key_12345678_x`);
  check('jeton dans l’URL refusé (400)', leaked.status === 400);
  const wrong = await anonymous.call('POST', '/sessions', { email: 'inconnu@example.org', password: 'mauvais-mot-de-passe' });
  check('échec de connexion uniforme (403, message générique)', wrong.status === 403 && wrong.body['code'] === 'identity.invalid_credentials', wrong.body);
  check('en-tête CSP présent', (await fetch(`${baseUrl}/healthz`)).headers.get('content-security-policy')?.includes("default-src 'self'") === true);
}

/**
 * Parcours projet et éléments.
 * @param api client connecté
 */
async function projectJourney(api: ApiClient): Promise<void> {
  const key = `R${randomBytes(3).toString('hex').toUpperCase().replaceAll(/[^A-Z0-9]/gu, 'X')}`.slice(0, 8);
  const created = await api.call('POST', '/projects', { key, name: `Projet de recette ${key}`, methodologyPackKey: 'scrum' });
  check('création d’un projet en brouillon', created.status === 201 && created.body['status'] === 'draft', created.body);
  check('configuration du pack Scrum prête', await eventually(async () => (await api.call('GET', `/projects/${key}`)).body['configurationReady'] === true));
  const activated = await api.call('POST', `/projects/${key}/actions/activate`, {});
  check('activation du projet', activated.status === 200 && activated.body['status'] === 'active', activated.body);
  const epic = await api.call('POST', `/projects/${key}/work-items`, { typeKey: 'epic', title: 'Gérer les inscriptions' });
  const story = await api.call('POST', `/projects/${key}/work-items`, { typeKey: 'story', title: 'Créer un formulaire d’inscription accessible', parentKey: epic.body['key'], estimate: 3 });
  check('création d’une epic et d’une story rattachée', epic.status === 201 && story.status === 201 && story.body['key'] === `${key}-2`, story.body);
  const task = await api.call('POST', `/projects/${key}/work-items`, { typeKey: 'task', title: 'Tâche orpheline interdite', parentKey: epic.body['key'] });
  check('hiérarchie refusée (tâche sous une epic, RG-WI-002)', task.status === 409, task.body);
  const moved = await api.call('POST', `/projects/${key}/work-items/${String(story.body['key'])}/actions/transition`, { toState: 'in_progress' });
  check('transition vers « En cours »', moved.status === 200 && moved.body['stateCategory'] === 'in_progress', moved.body);
  const stale = await api.call('PATCH', `/projects/${key}/work-items/${String(story.body['key'])}`, { title: 'Titre modifié' }, { 'if-match': '"1"' });
  check('modification avec version périmée refusée (412)', stale.status === 412, stale.body);
  check('backlog projeté', await eventually(async () => ((await api.call('GET', `/projects/${key}/backlog`)).body['data'] as unknown[] | undefined)?.length === 2));
  const board = await api.call('GET', `/projects/${key}/board`);
  const columns = (board.body['columns'] as { readonly state: { readonly key: string }; readonly items: unknown[] }[] | undefined) ?? [];
  check('board : la story est dans « En cours »', columns.find((column) => column.state.key === 'in_progress')?.items.length === 1, board.body);
  check('recherche plein texte française (« inscription »)', await eventually(async () => ((await api.call('GET', '/search?q=inscriptions')).body['data'] as unknown[] | undefined)?.length === 2));
  const closing = await api.call('POST', `/projects/${key}/actions/close`, { text: 'Bilan' });
  check('clôture refusée tant que des éléments sont ouverts (RG-PRJ-005)', closing.status === 409, closing.body);
}

const anonymous = createApiClient(baseUrl);
await securityChecks(anonymous);
const api = createApiClient(baseUrl);
const canLogin = setupCodeFile !== '-' || process.env['PV_SMOKE_PASSWORD_FILE'] !== undefined;
if (!canLogin) console.log('—  parcours complet ignoré : ni code d’initialisation ni compte de recette fournis');
else if (await login(api)) await projectJourney(api);
console.log(failures === 0 ? 'Tests de fumée : tous les contrôles sont passés.' : `Tests de fumée : ${String(failures)} contrôle(s) en échec.`);
process.exitCode = failures === 0 ? 0 : 1;
