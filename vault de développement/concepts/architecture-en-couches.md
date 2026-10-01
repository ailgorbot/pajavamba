---
type: concept
mise_a_jour: 2026-10-01
sources: [docs/regles-immuables.md §1-2, tsconfig.fonctionnel.json, eslint.config.js]
---

# Architecture en couches

| Couche | Où | Peut importer | Interdit |
|---|---|---|---|
| Basse (fonctionnel) | `services/<s>/fonctionnel` | [[kernel]] uniquement | `node:*`, Zod, pg, Fastify, pino, OPS, contrats, `Date`, `Math.random`, `console`, minuteries (RI-ARC-03, RI-ARC-08) |
| Moyenne (structure) | `services/<s>/structure` | fonctionnel, [[ops]], [[contracts]] | autre service (RI-SRV-02) |
| Haute (OPS) | `packages/ops` | kernel, contrats | métier |

- Contrôle : ESLint (`no-restricted-imports`, `no-restricted-globals`), `tsconfig.fonctionnel.json` (couche basse vérifiée sans types Node) et dependency-cruiser (`pnpm layers`, `.dependency-cruiser.cjs` : fonctionnel → structure interdit, fonctionnel limité au noyau, aucun import entre services, socle ignorant des services, noyau autonome, aucun cycle). Sentinelles CI : `tools/ci/sentinelles-qualite.sh`.
- Cas d'usage : fonctions `(dépendances, contexte, requête)` qui renvoient `Result` et des événements ; ports déclarés dans `fonctionnel/src/ports/`.
- Formatage : Prettier (largeur 200) appliqué progressivement aux fichiers modifiés (ADR-0009) ; découper une fonction qui dépasse 30 lignes après formatage.
- Seuils de code (RI-COD-03) : ≤ 30 lignes par fonction, ≤ 3 paramètres, complexité ≤ 10, profondeur ≤ 3, ≤ 300 lignes par fichier ; ni `any`, ni `enum`, ni `namespace`, ni `export default`.
- Les services ne communiquent que par événements (projections locales) ou par le client identity des contrats : aucun appel synchrone entre services (RI-SRV-03).

Voir aussi [[chaine-d-ecriture]], [[base-et-rls]].
