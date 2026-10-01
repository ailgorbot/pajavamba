import { describe, expect, it } from 'vitest';
import { formattable } from '../format-modifies.ts';

describe('adoption progressive de Prettier', () => {
  it('ne retient que les fichiers de code', () => {
    expect(formattable(['packages/ops/src/secrets.ts', 'apps/web/src/main.tsx', 'docs/adr/0009.md', 'pnpm-lock.yaml', '.dependency-cruiser.cjs', ''])).toEqual([
      'packages/ops/src/secrets.ts',
      'apps/web/src/main.tsx',
      '.dependency-cruiser.cjs',
    ]);
  });

  it('ignore le vault de développement', () => {
    expect(formattable(['vault de développement/outils/instantane-github.mjs'])).toEqual([]);
  });
});
