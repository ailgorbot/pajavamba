---
type: module
mise_a_jour: 2026-10-01
---

# outillage

- **Où** : `tools/` — Outils de développement et de CI.
- **Contenu** : `reference/generate-actions-reference.ts` et `reference/generate-catalogs.ts` (`pnpm reference[:check]` : actions, erreurs relevées dans `domainError`/`HttpProblem`, catalogue de journalisation, configuration décrite par `.meta()` dans `settings.ts`, matrice de traçabilité des règles `RG-*` via `reference/tracabilite.ts`), `smoke/` (`api-client.ts`, `smoke-test.ts`), `ci/check-pr-body.ts` (modèle de PR), `semgrep/audit-semgrep.ts` (`pnpm audit:semgrep`, [[audit-semgrep]]), `zap/audit-zap.ts` (`pnpm audit:zap`, [[audit-zap]]) ; et `vault de développement/outils/instantane-github.mjs`.
- **Voir** : [[processus-github]]. Tests : `tools/ci/tests/check-pr-body.test.ts`.
