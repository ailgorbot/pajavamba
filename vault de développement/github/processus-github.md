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
- Titre de PR `type(portée): description` (types et portées d'ADR-0003, minuscule initiale, sans point final) : vérifié par le workflow `pr`, relancé à chaque modification du titre ou de la description.
- Modèle de PR à 7 sections obligatoires (Story, Règles, Documentation, Sécurité, Données, Accessibilité, Migration) vérifié par le job CI « Modèle de PR complet » ; le corps se termine par la mention « Generated with Claude Code ».
- Avant toute poussée qui modifie du code exécuté : `pnpm audit:zap` ([[audit-zap]], RI-SEC-15).
- Avant toute poussée de code : `pnpm audit:semgrep` et triage des constats ([[audit-semgrep]], RI-SEC-14).
- Avant toute poussée de code : `pnpm format:modifies` (Prettier sur les fichiers modifiés, ADR-0009).
- Après création d'une PR dans l'application : `get_status`, sinon `bind_pr` ; pas de sondage de CI, pas de fusion automatique.
- CODEOWNERS : @ailgorbot sur tout, et explicitement sur les zones protégées.

## CI (`.github/workflows/ci.yml`)

| Job | Contrôles |
|---|---|
| Conformité de la PR (`pr.yml`) | `tools/ci/check-pr-title.ts` et `tools/ci/check-pr-body.ts`, relancés aussi à l'édition du titre ou de la description |
| Qualité | Fichiers de gouvernance présents, `pnpm typecheck`, `pnpm test`, `pnpm reference:check`, `pnpm lint`, `pnpm layers` (dependency-cruiser), sentinelles qualité, Prettier sur les fichiers modifiés (PR, ADR-0009), construction de l'interface |
| Pile conteneurisée | `docker compose up` avec secrets générés, migrations, tests de fumée, journaux en cas d'échec |

| Hygiène (L0-14) | gitleaks sur tout l'historique (binaire à empreinte vérifiée), `pnpm spell` (cspell), `pnpm lint:md` (markdownlint), sentinelles : jeton fictif détecté, commentaire anglais signalé |

`security.yml` (L0-16) : job « SAST Semgrep » (image `semgrep/semgrep` épinglée par empreinte, `semgrep --test .semgrep` puis analyse du dépôt) et job « Vulnérabilités des dépendances » (`pnpm audit --audit-level high`, sentinelle minimist 1.2.5). Déclencheurs : PR, `main`, chaque lundi. Une interpolation SQL légitime (identifiant validé) porte `// nosemgrep: pv-sql-concatenation` avec sa justification.

Actions épinglées par SHA (checkout, setup-node, pnpm/action-setup), `permissions: contents: read`, aucun `pull_request_target`.

## Versions (L0-17)

`release-please.yml` ouvre une PR de version `chore(socle): publier la version X.Y.Z` (changelog français, `bump-minor-pre-major`, départ au commit `e799ced`, manifeste à 0.4.0). **Inactif** tant que la variable de dépôt `RELEASE_PLEASE_ACTIF` ne vaut pas `true` et que GitHub Actions n'est pas autorisé à créer des PR (Settings → Actions → General) — réglages du mainteneur ; un jeton de GitHub App (L0-10) permettrait aussi à la CI de tourner sur la PR de version. Aucun tag `v0.4.0` n'existe encore : à poser par le mainteneur à la publication (L0-34).

## Publication (L0-18)

- `release.yml` (étiquette `v*`) : image `ghcr.io/ailgorbot/pajavamba/pv-app` amd64 + arm64, signée sans clé par cosign (OIDC), SBOM CycloneDX et provenance attestés et poussés au registre ; job dans l'environnement `release`. **À faire par le mainteneur** : créer l'environnement `release` avec un approbateur obligatoire (Settings → Environments), sinon GitHub le crée sans protection au premier tag.
- `docs.yml` (`main`, `docs/**`) : référence, Markdown et orthographe vérifiés, site assemblé ; publication Pages seulement si la variable `PAGES_ACTIF` vaut `true` et que Pages est activé avec la source « GitHub Actions ». Le site VitePress (L0-35) remplacera l'assemblage brut.

## À venir

GitHub App des agents (L0-10).
