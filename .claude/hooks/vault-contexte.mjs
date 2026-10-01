// Crochet SessionStart : rappelle le vault de développement et affiche les dernières entrées du journal (RI-DOC-10).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const vault = join(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), 'vault de développement');
let recent = '(journal introuvable)';
try {
  const entries = readFileSync(join(vault, 'log.md'), 'utf8').split('\n').filter((line) => line.startsWith('## ['));
  recent = entries.slice(-5).join('\n');
} catch {
  // Vault absent : le rappel suffit.
}
process.stdout.write(`Règle RI-DOC-10 : consulter d'abord « vault de développement/index.md », puis le code (qui fait foi), puis GitHub ; doute persistant → skill grill-me. Mettre le vault à jour après chaque PR fusionnée, lot, décision, incident et avant compactage.
Dernières entrées du journal du vault :
${recent}
`);
