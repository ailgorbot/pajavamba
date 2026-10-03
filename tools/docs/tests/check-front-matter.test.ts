import { describe, expect, it } from 'vitest';
import { frontMatterProblems } from '../check-front-matter.ts';

const PAGE = (fields: string): string => `---\n${fields}\n---\n\n# Titre\n`;

describe('front-matter de la documentation', () => {
  it('accepte une page complète', () => {
    expect(frontMatterProblems(PAGE('titre: Guide\npublic: utilisateurs\nmise_a_jour: 2026-10-02'))).toEqual([]);
  });

  it('refuse une page sans champ « mise_a_jour »', () => {
    expect(frontMatterProblems(PAGE('titre: Guide\npublic: utilisateurs'))).toEqual(['champ « mise_a_jour » manquant ou hors format AAAA-MM-JJ']);
  });

  it('refuse une date hors format et une page sans front-matter', () => {
    expect(frontMatterProblems(PAGE('titre: Guide\npublic: utilisateurs\nmise_a_jour: 02/10/2026'))).toHaveLength(1);
    expect(frontMatterProblems('# Sans en-tête\n')).toEqual(['front-matter absent']);
  });

  it('dispense de date une page générée depuis le code', () => {
    expect(frontMatterProblems(PAGE('titre: Référence\npublic: développeurs\nstatut: généré'))).toEqual([]);
  });
});
