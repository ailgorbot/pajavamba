// Crochet PreCompact : ajoute au journal du vault un instantané mécanique (branche, commits, fichiers modifiés)
// pour que la session suivante sache où reprendre (RI-DOC-10). À compléter par l'agent après le compactage.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const log = join(root, 'vault de développement', 'log.md');
const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return '(indisponible)';
  }
};
let trigger = 'auto';
try {
  trigger = JSON.parse(readFileSync(0, 'utf8')).trigger ?? trigger;
} catch {
  // Entrée absente : déclenchement automatique supposé.
}
if (existsSync(log)) {
  const day = new Date().toISOString().slice(0, 10);
  const changed = git('status', '--short').split('\n').filter(Boolean).length;
  appendFileSync(log, `
## [${day}] compactage | instantané automatique (${trigger})

- Branche : \`${git('branch', '--show-current')}\` ; fichiers modifiés non commités : ${changed}.
- Derniers commits :
${git('log', '--format=  - %h %s', '-5')}
- À compléter à la reprise : travail en cours, décisions prises, prochaine étape.
`);
}
