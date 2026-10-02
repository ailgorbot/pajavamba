/**
 * Vérifie que le titre d'une PR suit Conventional Commits avec les portées du projet : il devient le message
 * du commit de fusion (squash) et alimente release-please. Le titre est lu dans `PR_TITLE`.
 *
 * Outillage. Règles : RI-NOM-09, RI-VER-01, ADR-0003.
 */
export const TYPES = ['feat', 'fix', 'docs', 'refactor', 'perf', 'test', 'ci', 'build', 'chore', 'revert'] as const;
export const SCOPES = ['identity', 'policy', 'portfolio', 'workflow', 'workitem', 'query', 'audit', 'event-relay', 'api-gateway', 'web', 'socle', 'docs', 'ci', 'deploy', 'ui'] as const;

const HEADER = /^(?<type>[a-z]+)(?:\((?<scope>[a-z-]+)\))?!?: (?<description>.+)$/u;

/**
 * Liste les écarts d'un titre de PR à la convention.
 * @param title titre de la PR
 * @returns messages d'erreur (vide si conforme)
 */
export function titleProblems(title: string): string[] {
  const match = HEADER.exec(title.trim());
  if (match?.groups === undefined) return ['Format attendu : « type(portée): description » (ex. « fix(identity): refuser un jeton expiré »).'];
  const { type = '', scope, description = '' } = match.groups;
  const problems: string[] = [];
  if (!(TYPES as readonly string[]).includes(type)) problems.push(`Type « ${type} » inconnu ; types admis : ${TYPES.join(', ')}.`);
  if (scope !== undefined && !(SCOPES as readonly string[]).includes(scope)) problems.push(`Portée « ${scope} » inconnue ; portées admises : ${SCOPES.join(', ')}.`);
  if (!/^\p{Ll}/u.test(description)) problems.push('La description commence par une minuscule (verbe à l’infinitif, en français).');
  if (description.endsWith('.')) problems.push('La description ne se termine pas par un point.');
  return problems;
}

if (import.meta.main) {
  const problems = titleProblems(process.env['PR_TITLE'] ?? '');
  for (const problem of problems) console.error(`::error::Titre de PR non conforme (RI-NOM-09) : ${problem}`);
  process.exitCode = problems.length === 0 ? 0 : 1;
}
