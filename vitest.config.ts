/**
 * Configuration des tests : projets `unit` (sans entrée/sortie) et `integration` (PostgreSQL réel).
 *
 * Règles : RI-TST-01, RI-TST-05, RI-TST-08.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['packages/*/tests/**/*.test.ts', 'services/*/fonctionnel/tests/**/*.test.ts', 'services/*/structure/tests/**/*.test.ts'],
          exclude: ['**/*.int.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['**/tests/**/*.int.test.ts'],
          exclude: ['**/node_modules/**'],
          testTimeout: 120_000,
          hookTimeout: 180_000,
          fileParallelism: false,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['services/*/fonctionnel/src/**'],
    },
  },
});
