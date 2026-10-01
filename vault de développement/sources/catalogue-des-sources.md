---
type: source
mise_a_jour: 2026-10-01
---

# Catalogue des sources brutes

Les sources ne sont jamais modifiées par le vault : on les lit et on en tire des synthèses. En cas de divergence, l'ordre de vérité est : **code > `docs/` et GitHub > vault**.

| Source | Où | Ce qu'on y trouve |
|---|---|---|
| Code | `packages/`, `services/`, `apps/web/`, `deploy/`, `tools/` | La vérité sur le comportement. Carte : [[carte-du-depot]] |
| Règles immuables | `docs/regles-immuables.md` | Ce qui ne se négocie jamais. Essentiel : [[regles-immuables-essentiel]] |
| Spécifications | `docs/specifications/technique/specifications-techniques.md` | Cible fonctionnelle et technique (§ cités par les stories) |
| Décomposition | `docs/developpeur/contribuer/decomposition-du-developpement.md` | Lots, versions, ordre de construction, porte de livraison |
| ADR | `docs/adr/` | Décisions structurantes. Registre : [[registre-des-adr]] |
| Référence des actions | `docs/reference/actions.md` (générée) | Routes, permissions, niveaux de risque |
| Journal des modifications | `CHANGELOG.md` | Contenu de chaque version |
| Issues et projet | github.com/ailgorbot/pajavamba, projet n° 2 | Stories (récit, Gherkin, règles), statut. Instantané : [[etat-des-stories]] |
| PR | github.com/ailgorbot/pajavamba/pulls | Diff, discussion, CI. Synthèse : [[historique-des-pr]] |
| Documents d'origine | `Documents Chat/` (local, exclu de Git) | Versions sources des spécifications et du backlog copiées dans `docs/` |
| Échanges avec le mainteneur | Conversations Claude Code | Consignes et choix ; instantanés datés dans `sources/` |

## Instantanés datés

- [[2026-10-01-decisions-du-mainteneur]] — consignes et choix des sessions du 29/09 au 01/10/2026.
