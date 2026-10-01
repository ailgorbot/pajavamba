---
type: github
mise_a_jour: 2026-10-01
sources: [gh pr list --state all, git log origin/main]
---

# Historique des PR

| PR | Branche | Fusion | Contenu | Remarques |
|---|---|---|---|---|
| — | `main` | 29/09 | `56338e3` amorçage : spécifications, règles immuables, marque | Commit non signé (choix du mainteneur) |
| [#249](https://github.com/ailgorbot/pajavamba/pull/249) | `feat/L0-socle` | 30/09 | Lot 0 : socle du MVP | Base de la pile de PR |
| [#248](https://github.com/ailgorbot/pajavamba/pull/248) | `feat/L1-identite` | 30/09 | Lot 1 : identité et accès | Empilée sur #249 |
| [#250](https://github.com/ailgorbot/pajavamba/pull/250) | `feat/L2-projets` | 30/09 | Lot 2 : projets et équipes | Titre de branche par défaut (« Feat/l2 projets ») |
| [#252](https://github.com/ailgorbot/pajavamba/pull/252) | `feat/L2-projets` | 30/09 | Complément du lot 2 | Même branche que #250 |
| [#251](https://github.com/ailgorbot/pajavamba/pull/251) | `feat/L3-elements` | 30/09 | Lot 3 : éléments, workflows, backlog, board | Conflit mal résolu à la fusion : `tools/smoke` cassé |
| [#253](https://github.com/ailgorbot/pajavamba/pull/253) | `feat/L3-elements` | 30/09 | Complément du lot 3 | Même branche que #251 |
| [#255](https://github.com/ailgorbot/pajavamba/pull/255) | `fix/254-outils-fumee` | 01/10 | Rétablit `tools/smoke` | Corrige les deux échecs de CI signalés par le mainteneur |
| [#256](https://github.com/ailgorbot/pajavamba/pull/256) | `docs/8-gouvernance` | 01/10 | L0-08 gouvernance | Première PR « une story » |
| [#257](https://github.com/ailgorbot/pajavamba/pull/257) | `ci/9-modeles-contribution` | 01/10 | L0-09 modèles et contrôle du modèle de PR | — |
| [#259](https://github.com/ailgorbot/pajavamba/pull/259) | `docs/258-vault-regle` | 01/10 | RI-DOC-10, ADR-0007, CLAUDE.md, grill-me, crochets | — |
| [#261](https://github.com/ailgorbot/pajavamba/pull/261) | `docs/258-vault-concepts` | 01/10 | Vault : modules, concepts, décisions, exploitation, leçons | Fusionnée avant #260 (fichiers disjoints, sans conséquence) |
| [#260](https://github.com/ailgorbot/pajavamba/pull/260) | `docs/258-vault-socle` | 01/10 | Vault : schéma, index, lots, GitHub | Lint en échec tant que #259 n'était pas fusionnée ; `main` fusionnée dans la branche |
| [#262](https://github.com/ailgorbot/pajavamba/pull/262) | `docs/258-regle-vault` | 01/10 | Doublon de #259 (ancienne branche) | Fusion vide (contenu identique à `main`) ; branche supprimée |
| [#263](https://github.com/ailgorbot/pajavamba/pull/263) | `ci/14-hygiene-depot` | 01/10 | L0-14 : gitleaks, cspell, markdownlint + ingestion du vault | 4 faux positifs gitleaks dans l'historique, ignorés par empreinte |
| [#264](https://github.com/ailgorbot/pajavamba/pull/264) | `ci/16-securite` | 01/10 | L0-16 : `security.yml`, règles Semgrep, requêtes SQL littérales | Premier passage : 2 puis 11 interpolations SQL trouvées |
| [#268](https://github.com/ailgorbot/pajavamba/pull/268) | `fix/265-aes-gcm` | 01/10 | #265 : étiquette AES-GCM imposée, premiers tests de `ops` | Audit Semgrep |
| [#269](https://github.com/ailgorbot/pajavamba/pull/269) | `build/266-approvisionnement` | 01/10 | #266 : durcissement pnpm/npm | Audit Semgrep |
| [#270](https://github.com/ailgorbot/pajavamba/pull/270) | `ci/267-faux-positifs-semgrep` | 01/10 | #267 : faux positif `sendFile`, erreurs d'analyse | Audit Semgrep |
| [#272](https://github.com/ailgorbot/pajavamba/pull/272) | `docs/271-audit-semgrep` | 01/10 | L0-38 : RI-SEC-14, ADR-0008, `tools/semgrep`, vault | Basée sur #264, fusionnée après elle |
| à venir | `ci/273-audit-officiel-planifie` | — | #273 : jeux officiels Semgrep chaque lundi en CI | — |
| à venir | `ci/16-securite` | — | L0-16 : `security.yml` (Semgrep, audit des dépendances) | — |

Toutes les fusions sont faites par le mainteneur (squash). Après le MVP, la règle est **une PR par story** (≤ 400 lignes) ; l'empilement de PR par lot n'a servi qu'au MVP et a provoqué l'incident de #251 ([[lecons-apprises]]).

Mettre à jour cette page à chaque PR ouverte ou fusionnée (opération « ingérer » de [[SCHEMA]]).
