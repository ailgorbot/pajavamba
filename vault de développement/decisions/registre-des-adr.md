---
type: décision
mise_a_jour: 2026-10-01
sources: [docs/adr/]
---

# Registre des ADR

| ADR | Statut | Décision en une ligne |
|---|---|---|
| [0001](../../docs/adr/0001-licence-du-coeur.md) Licence | Acceptée 30/09 par le mainteneur | Apache-2.0 ; dépendances compatibles ; contributions sous la même licence |
| [0002](../../docs/adr/0002-versions-figees.md) Versions | Acceptée (revue mainteneur attendue) | Node 24, PostgreSQL 18, TypeScript 6.0.3, pnpm 10.34.6, pas de Rust ; versions exactes |
| [0003](../../docs/adr/0003-conventions-git.md) Git | Acceptée (revue attendue) | Conventional Commits FR, portées par service ou `socle/docs/ci/deploy/ui`, squash, signés |
| [0004](../../docs/adr/0004-livraison-recette-coolify.md) Recette | Acceptée (revue attendue) | Compose sur Coolify, image construite sur le VPS (temporaire), secrets générés par `pv-init` |
| [0005](../../docs/adr/0005-theme-recette.md) Thème | Acceptée (revue attendue) | DSFR thème neutre via `packages/ui`, sans Marianne |
| [0006](../../docs/adr/0006-ecarts-du-mvp.md) Écarts du MVP | **Proposée — à valider par le mainteneur** | E1 policy TS au lieu de Cedar ; E2 `pg` sans Kysely ; E3 une unité `pv-app` ; E4 relais en processus ; E5 comptes locaux + TOTP ; E6 audit non ancré ; E7 build sur VPS ; E8 CSP assouplie pour le DSFR |
| [0007](../../docs/adr/0007-vault-de-developpement.md) Vault | Acceptée 01/10 à la demande du mainteneur (PR #259) | Vault LLM Wiki, règle RI-DOC-10, grill-me, crochets |

Une décision structurante nouvelle = une ADR numérotée à la suite, puis une ligne ici et une entrée `décision` dans [[log]]. Choix plus légers : [[journal-des-decisions]].
