---
type: module
mise_a_jour: 2026-10-01
---

# outillage

- **Où** : `tools/` — Outils de développement et de CI.
- **Contenu** : `reference/generate-actions-reference.ts` (`pnpm reference[:check]`), `smoke/` (`api-client.ts`, `smoke-test.ts`), `ci/check-pr-body.ts` (modèle de PR), `semgrep/audit-semgrep.ts` (`pnpm audit:semgrep`, [[audit-semgrep]]), `zap/audit-zap.ts` (`pnpm audit:zap`, [[audit-zap]]) ; et `vault de développement/outils/instantane-github.mjs`.
- **Documentation** : `docs/check-front-matter.ts` (`pnpm docs:front-matter`, CI) : `titre`, `public` et `mise_a_jour` obligatoires, dates au format AAAA-MM-JJ, pages générées dispensées de date (L0-35).
- **Voir** : [[processus-github]]. Tests : `tools/ci/tests/check-pr-body.test.ts`.
