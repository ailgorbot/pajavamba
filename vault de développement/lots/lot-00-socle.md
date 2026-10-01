---
type: lot
mise_a_jour: 2026-10-01
sources: [PR #249, #255, #256, #257, docs/developpeur/contribuer/decomposition-du-developpement.md §6.3, CHANGELOG.md]
---

# Lot 0 — Socle (cible 0.1.0, livré dans le MVP 0.4.0)

**Résultat vérifiable attendu** : un service exemple passe toute la CI ; documentation publiée ; tag déployé sur Coolify.

## Livré

| Brique | Où | PR |
|---|---|---|
| Monorepo pnpm, TypeScript 6.0.3 strict, Node 24 sans transpileur | racine, ADR-0002 | #249 |
| Noyau typé | [[kernel]] | #249 |
| Contrats : permissions, registre d'actions, événements | [[contracts]] | #249 |
| Couche OPS : config, journal catalogué, RFC 9457, sondes, base, migrateur, secrets, chaîne d'écriture | [[ops]] | #249 |
| Façade DSFR, thème neutre | [[ui]], ADR-0005 | #249 |
| Image OCI non root, composition, secrets générés | [[pv-app-et-compose]], ADR-0004 | #249 |
| CI (`ci.yml`), tests de fumée, référence générée | [[outillage]], [[processus-github]] | #249, #255 |
| Seuils de lint résorbés (story L0-36, issue #254) | `eslint.config.js` | lots et #255 |
| Gouvernance (L0-08) : SECURITY, CONTRIBUTING, CODE_OF_CONDUCT, GOVERNANCE, CODEOWNERS | racine, `.github/` | #256 |
| Modèles de PR et de tickets, contrôle CI du modèle (L0-09) | `.github/`, `tools/ci/` | #257 |
| ADR 0001 à 0006 | `docs/adr/` | #249 et suivantes |

## Partiel ou reporté

| Story | Reste à faire |
|---|---|
| L0-13 (#13) | Prettier, dependency-cruiser (les couches sont contrôlées aujourd'hui par ESLint et les `tsconfig`) |
| L0-23 (#23) | Client HTTP résilient (disjoncteur), limitation de débit |
| L0-27 (#27) | Registre des règles et traçabilité générés (seule la référence des actions l'est) |
| L0-34 (#34) | Livraison automatique, images GHCR signées, tag `v0.1.0` (aujourd'hui : construction sur le VPS, ADR-0004) |
| Backlog | L0-01 rulesets, L0-02 sécurité du dépôt, L0-10 GitHub App des agents, L0-12 et L0-25 Rust (non introduit, RI-ARC-13), L0-17 release-please, L0-18 `docs.yml`/`release.yml`, L0-32 superviseur `pajavamba`, L0-35 site VitePress |
| L0-14 (#14) | Livré (#263) |
| L0-16 (#16) | Livré (#264) : Semgrep (règles du projet), audit des dépendances ; CodeQL et analyse d'images restent à faire (L0-02, L0-34) |
| L0-37 (#258) | Livré (#259 à #262) |
| L0-38 (#271) | Livré (#272) : audit Semgrep à chaque livraison (RI-SEC-14) ; suite #273 (CI planifiée) |

Pas de Nx : pnpm seul. Statuts détaillés : [[etat-des-stories]].
