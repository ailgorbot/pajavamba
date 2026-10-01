/**
 * Vérifie qu'une description de PR remplit toutes les sections du modèle
 * (`.github/pull_request_template.md`) ; la description est lue dans `PR_BODY`.
 *
 * Outillage. Règles : RI-REV-05 (modèle de PR complet), RI-GIT-06.
 */
export const REQUIRED_SECTIONS = ['Story', 'Règles', 'Documentation', 'Sécurité', 'Données', 'Accessibilité', 'Migration'] as const;

/**
 * Retire les commentaires HTML, qui ne comptent pas comme contenu.
 * @param text texte brut
 * @returns texte sans commentaires
 */
function stripComments(text: string): string {
  let result = '';
  let position = 0;
  for (let start = text.indexOf('<!--'); start !== -1; start = text.indexOf('<!--', position)) {
    const end = text.indexOf('-->', start + 4);
    result += text.slice(position, start);
    position = end === -1 ? text.length : end + 3;
  }
  return result + text.slice(position);
}

/**
 * Découpe la description en sections de niveau 2.
 * @param body description de la PR
 * @returns contenu de chaque section, par titre
 */
function sections(body: string): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  let current: string | undefined;
  for (const line of stripComments(body).split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      current = line.slice(3).trim();
      result.set(current, '');
    } else if (current !== undefined) {
      result.set(current, `${result.get(current) ?? ''}${line}\n`);
    }
  }
  return result;
}

/**
 * Indique si le contenu d'une section est renseigné ; « Closes # » sans numéro ne compte pas.
 * @param content contenu de la section
 * @returns vrai si la section est remplie
 */
function isFilled(content: string): boolean {
  return content
    .split('\n')
    .map((line) => line.trim().replaceAll(/\s+/g, ' '))
    .some((line) => line !== '' && !/^(?:closes|fixes|refs) ?#$/i.test(line));
}

/**
 * Liste les sections obligatoires absentes ou vides.
 * @param body description de la PR
 * @returns titres des sections à compléter
 */
export function missingSections(body: string): readonly string[] {
  const found = sections(body);
  return REQUIRED_SECTIONS.filter((title) => !isFilled(found.get(title) ?? ''));
}

if (import.meta.main) {
  const missing = missingSections(process.env['PR_BODY'] ?? '');
  for (const title of missing) console.error(`::error::Section « ${title} » absente ou vide dans la description de la PR (RI-REV-05).`);
  process.exitCode = missing.length === 0 ? 0 : 1;
}
