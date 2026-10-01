/**
 * Règles de lint bloquantes en CI.
 *
 * Règles : RI-COD-01 à RI-COD-07, RI-COD-11, RI-COD-13, RI-ARC-08 (couche fonctionnelle sans
 * horloge, aléa, console, processus ni module node:*), §19.2 (seuils).
 */
import js from '@eslint/js';
import sonarjs from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';

const FORBIDDEN_SYNTAX = [
  { selector: 'TSEnumDeclaration', message: 'enum interdit (RI-COD-02) : utiliser une union de littéraux.' },
  { selector: 'TSModuleDeclaration[kind="namespace"]', message: 'namespace interdit (RI-COD-02).' },
  { selector: 'ExportDefaultDeclaration', message: 'export default interdit (RI-COD-02).' },
];

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', 'Documents Chat/**', '.claude/**', '.semgrep/**', 'vault de développement/**', 'eslint.config.js', '.dependency-cruiser.cjs', '**/vite.config.ts', 'vitest.config.ts'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  sonarjs.configs.recommended,
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      'no-restricted-syntax': ['error', ...FORBIDDEN_SYNTAX],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: false }],
      'max-params': ['error', 3],
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 30, skipBlankLines: true, skipComments: true, IIFEs: true }],
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/todo-tag': 'off',
      'no-warning-comments': ['error', { terms: ['todo(?!\\(#\\d+\\))'], location: 'start' }],
    },
  },
  {
    files: ['services/*/fonctionnel/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', { name: 'Date', message: 'Utiliser le port Clock (RI-ARC-08).' }, { name: 'process', message: 'Interdit dans la couche fonctionnelle (RI-ARC-08).' }, { name: 'console', message: 'La couche fonctionnelle ne journalise jamais (RI-LOG-01).' }, { name: 'setTimeout', message: 'Minuteries interdites (RI-ARC-08).' }, { name: 'setInterval', message: 'Minuteries interdites (RI-ARC-08).' }, { name: 'crypto', message: 'Utiliser le port IdGenerator (RI-ARC-08).' }],
      'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: 'Aléa interdit dans la couche fonctionnelle (RI-ARC-08).' }],
      'no-restricted-imports': ['error', { patterns: [{ group: ['node:*', 'zod', 'pg', 'fastify', 'pino', '@pajavamba/ops', '@pajavamba/contracts'], message: 'Import interdit dans la couche fonctionnelle (RI-ARC-03).' }] }],
    },
  },
  {
    files: ['**/tests/**/*.ts', 'tools/**/*.ts'],
    rules: { 'max-lines-per-function': 'off', 'sonarjs/no-nested-functions': 'off' },
  },
);
