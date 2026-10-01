---
type: github
mise_a_jour: 2026-10-01
sources: [.github/, CONTRIBUTING.md, GOVERNANCE.md, ADR-0003, projet GitHub n° 2]
---

# Processus GitHub

## Dépôt et backlog

- Dépôt public [ailgorbot/pajavamba](https://github.com/ailgorbot/pajavamba) ; branche `main`. Rulesets **pas encore activés** (L0-01, action du mainteneur).
- Projet v2 n° 2 « PajaVamba Iterative development » : champs `Status` (Backlog, In progress, Done), `Lot`, `Ordre`, `Criticité`, `Version cible`. Modifier un champ : `gh project item-edit 2 --owner ailgorbot --url <issue> --field Status --value "In progress"` (forme par nom, plus fiable que les identifiants).
- 16 jalons (lots 0 à 15) ; stories `[Lx-nn] titre` ; étiquettes `type:*`, `service:*`, `priorite:P0..P3`, `phase:*`, plus `bug`.
- Une story livrée passe à **Done** dans le projet ; l'issue est fermée par `Closes #n` à la fusion. Une story partielle reste **In progress** avec un commentaire indiquant ce qui reste.
- Nouvelle story hors backlog initial : la créer avec le modèle « Story », jalon et étiquettes, puis l'ajouter au projet (`gh project item-add 2 --owner ailgorbot --url …`). Exemple : L0-37 (#258).

## Branches, commits, PR

- Branche `<type>/<n° issue>-<description>` ; Conventional Commits (type anglais, description française, portées d'ADR-0003) ; commits **signés SSH** (voir [[poste-de-developpement]]) avec le pied `Co-Authored-By` de l'agent.
- Modèle de PR à 7 sections obligatoires (Story, Règles, Documentation, Sécurité, Données, Accessibilité, Migration) vérifié par le job CI « Modèle de PR complet » ; le corps se termine par la mention « Generated with Claude Code ».
- Avant toute poussée de code : `pnpm audit:semgrep` et triage des constats ([[audit-semgrep]], RI-SEC-14).
- Après création d'une PR dans l'application : `get_status`, sinon `bind_pr` ; pas de sondage de CI, pas de fusion automatique.
- CODEOWNERS : @ailgorbot sur tout, et explicitement sur les zones protégées.

## CI (`.github/workflows/ci.yml`)

| Job | Contrôles |
|---|---|
| Modèle de PR complet | `tools/ci/check-pr-body.ts` (PR seulement ; relancé au push, pas à l'édition de la description) |
| Qualité | Fichiers de gouvernance présents, `pnpm typecheck`, `pnpm test`, `pnpm reference:check`, `pnpm lint`, construction de l'interface |
| Pile conteneurisée | `docker compose up` avec secrets générés, migrations, tests de fumée, journaux en cas d'échec |

| Hygiène (L0-14) | gitleaks sur tout l'historique (binaire à empreinte vérifiée), `pnpm spell` (cspell), `pnpm lint:md` (markdownlint), sentinelles : jeton fictif détecté, commentaire anglais signalé |

`security.yml` (L0-16) : job « SAST Semgrep » (image `semgrep/semgrep` épinglée par empreinte, `semgrep --test .semgrep` puis analyse du dépôt) et job « Vulnérabilités des dépendances » (`pnpm audit --audit-level high`, sentinelle minimist 1.2.5). Déclencheurs : PR, `main`, chaque lundi. Une interpolation SQL légitime (identifiant validé) porte `// nosemgrep: pv-sql-concatenation` avec sa justification.

Actions épinglées par SHA (checkout, setup-node, pnpm/action-setup), `permissions: contents: read`, aucun `pull_request_target`.

## À venir

release-please (L0-17), `docs.yml`/`release.yml` (L0-18), GitHub App des agents (L0-10).
