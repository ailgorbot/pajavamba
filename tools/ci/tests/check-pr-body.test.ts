import { describe, expect, it } from 'vitest';
import { missingSections, REQUIRED_SECTIONS } from '../check-pr-body.ts';

const COMPLETE = REQUIRED_SECTIONS.map((title) => `## ${title}\n\nContenu de ${title}.\n`).join('\n');

describe('contrôle du modèle de PR', () => {
  it('accepte une description dont toutes les sections sont remplies', () => {
    expect(missingSections(COMPLETE)).toEqual([]);
  });

  it('signale la section Accessibilité vide', () => {
    const body = COMPLETE.replace('Contenu de Accessibilité.', '<!-- RGAA -->');
    expect(missingSections(body)).toEqual(['Accessibilité']);
  });

  it('ne tient pas « Closes # » sans numéro pour une story renseignée', () => {
    const body = COMPLETE.replace('Contenu de Story.', 'Closes #');
    expect(missingSections(body)).toEqual(['Story']);
  });

  it('signale toutes les sections d\'une description vide', () => {
    expect(missingSections('')).toEqual([...REQUIRED_SECTIONS]);
  });
});
