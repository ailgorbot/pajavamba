// Génère « github/etat-des-stories.md » depuis le projet GitHub n° 2 (statut de chaque story par lot).
// Usage : node "vault de développement/outils/instantane-github.mjs"  (gh authentifié, portée project).
// Page générée : ne pas modifier à la main ; relancer après chaque changement de statut (RI-DOC-10).
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const gh = process.env.GH ?? 'gh';
const raw = execFileSync(gh, ['project', 'item-list', '2', '--owner', 'ailgorbot', '--limit', '500', '--format', 'json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const items = JSON.parse(raw).items;
const lots = new Map();
for (const item of items) {
  const lot = item.lot ?? 'Hors lot';
  if (!lots.has(lot)) lots.set(lot, []);
  lots.get(lot).push(item);
}
const order = ['Done', 'In progress', 'Backlog', 'Todo'];
const row = (i) => `| [#${i.content.number}](https://github.com/ailgorbot/pajavamba/issues/${i.content.number}) | ${i.title.replaceAll('|', '\|')} | ${i.status ?? '—'} |`;
const out = [
  '---',
  'type: généré',
  `mise_a_jour: ${new Date().toISOString().slice(0, 10)}`,
  'source: projet GitHub n° 2 (gh project item-list)',
  '---',
  '',
  '# État des stories (page générée)',
  '',
  'Générée par `outils/instantane-github.mjs`. Synthèse et interprétation : [[etat-du-projet]] et pages de [[index|lots]].',
  '',
  '| Lot | Done | In progress | Backlog |',
  '|---|---|---|---|',
];
const sorted = [...lots.keys()].sort();
for (const lot of sorted) {
  const count = (s) => lots.get(lot).filter((i) => (i.status ?? 'Backlog') === s).length;
  out.push(`| ${lot} | ${count('Done')} | ${count('In progress')} | ${count('Backlog') + count('Todo')} |`);
}
for (const lot of sorted) {
  const list = lots.get(lot);
  if (!list.some((i) => i.status === 'Done' || i.status === 'In progress')) continue;
  list.sort((a, b) => order.indexOf(a.status ?? 'Backlog') - order.indexOf(b.status ?? 'Backlog') || a.content.number - b.content.number);
  out.push('', `## ${lot}`, '', '| Issue | Story | Statut |', '|---|---|---|', ...list.map(row));
}
writeFileSync(join(import.meta.dirname, '..', 'github', 'etat-des-stories.md'), `${out.join('\n')}\n`);
console.log(`${items.length} éléments, ${lots.size} lots`);
