import { describe, expect, it } from 'vitest';
import { titleProblems } from '../check-pr-title.ts';

describe('titre de PR Conventional Commits', () => {
  it('accepte un titre conforme', () => {
    expect(titleProblems('feat(portfolio): créer un projet en brouillon')).toEqual([]);
    expect(titleProblems('chore(socle): publier la version 0.5.0')).toEqual([]);
    expect(titleProblems('fix!: retirer une route obsolète')).toEqual([]);
  });

  it('refuse un titre sans type (« correction divers »)', () => {
    expect(titleProblems('correction divers')).toHaveLength(1);
  });

  it('refuse un type ou une portée inconnus', () => {
    expect(titleProblems('feature(portfolio): créer un projet')).toHaveLength(1);
    expect(titleProblems('feat(projets): créer un projet')).toHaveLength(1);
  });

  it('refuse une description en majuscule ou terminée par un point', () => {
    expect(titleProblems('fix(web): Corriger le board.')).toHaveLength(2);
  });
});
