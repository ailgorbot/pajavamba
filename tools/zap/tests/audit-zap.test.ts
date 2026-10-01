import { describe, expect, it } from 'vitest';
import { findings, justifications, parseOptions, ZAP_IMAGE, zapArguments } from '../audit-zap.ts';

// eslint-disable-next-line sonarjs/no-clear-text-protocols -- adresse de la pile Docker éphémère, sans TLS, utilisée par l'audit
const LOCAL = 'http://pv-app:8080';

const ALERT = (pluginid: string, params: readonly string[]) => ({
  pluginid,
  name: `règle ${pluginid}`,
  riskdesc: 'Low (Medium)',
  instances: params.map((param) => ({ uri: `${LOCAL}/`, param })),
});

describe('audit ZAP', () => {
  it("analyse passivement la pile locale avec l'image épinglée et le spider AJAX", () => {
    const args = zapArguments(parseOptions([]), '/depot/.zap');
    expect(args).toContain(ZAP_IMAGE);
    expect(args).toContain('zap-baseline.py');
    expect(args).toContain('-j');
  });

  it('refuse une analyse active hors réseau Docker éphémère (recette)', () => {
    expect(() => zapArguments(parseOptions(['--cible', 'https://recette.exemple.fr', '--actif']), '/depot/.zap')).toThrow(/refusée/);
  });

  it("autorise l'analyse active sur un réseau Docker éphémère", () => {
    expect(zapArguments(parseOptions(['--cible', LOCAL, '--reseau', 'ci_default', '--actif']), '/depot/.zap')).toContain('zap-full-scan.py');
  });

  it('écarte les règles ignorées et les faux positifs par paramètre, mais garde les autres paramètres', () => {
    const justified = justifications('# commentaire\n10109\tIGNORE\t(x)\n', '120000\tscheme\tthème DSFR\n');
    const lines = findings([ALERT('10109', ['']), ALERT('120000', ['scheme']), ALERT('120000', ['jeton'])], justified);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('jeton');
  });
});
