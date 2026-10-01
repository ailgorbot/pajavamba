import { describe, expect, it } from 'vitest';
import { dockerArguments, REGISTRY_RULESETS, SEMGREP_IMAGE, summarize } from '../audit-semgrep.ts';

describe('audit Semgrep', () => {
  it('lance l\'image épinglée avec les règles du projet et les jeux officiels', () => {
    const args = dockerArguments('/depot', true);
    expect(args).toContain(SEMGREP_IMAGE);
    expect(args).toContain('.semgrep/regles-projet.yml');
    for (const ruleset of REGISTRY_RULESETS) expect(args).toContain(ruleset);
    expect(args).toContain('--metrics=off');
  });

  it('se passe des règles du projet quand elles sont absentes', () => {
    expect(dockerArguments('/depot', false)).not.toContain('.semgrep/regles-projet.yml');
  });

  it('résume constats et erreurs d\'analyse', () => {
    const lines = summarize({
      results: [{ check_id: 'javascript.node-crypto.security.gcm-no-tag-length', path: 'packages/ops/src/secrets.ts', start: { line: 204 }, extra: { severity: 'ERROR' } }],
      errors: [{ message: 'Erreur de syntaxe\ndétail', path: 'a.yml' }],
    });
    expect(lines[0]).toContain('gcm-no-tag-length');
    expect(lines[0]).toContain('packages/ops/src/secrets.ts:204');
    expect(lines.at(-1)).toBe('Bilan : 1 constat(s), 1 erreur(s) d\'analyse.');
  });
});
