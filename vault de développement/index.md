---
type: index
mise_a_jour: 2026-10-01
---

# Index du vault de développement

Point d'entrée obligatoire (RI-DOC-10). Conventions et opérations : [[SCHEMA]]. Journal : [[log]].

## Synthèse

| Page | Résumé |
|---|---|
| [[etat-du-projet]] | Où en est PajaVamba, ce qui est en cours, prochaines étapes |
| [[carte-du-depot]] | Où trouver quoi dans le dépôt, commandes utiles |

## Lots

| Page | Résumé |
|---|---|
| [[lot-00-socle]] | Monorepo, kernel, contrats, OPS, UI, CI, livraison (0.1.0) — fusionné via #249, gouvernance #256, modèles #257 |
| [[lot-01-identite-acces]] | identity, policy, audit, event-relay, api-gateway (0.2.0) — #248 |
| [[lot-02-projets-equipes]] | portfolio, cycle de vie des projets, équipes, interface (0.3.0) — #250/#252 |
| [[lot-03-elements-workflows]] | workflow, workitem, query, backlog, board (0.4.0, MVP) — #251/#253 |
| [[lots-04-a-15]] | Feuille de route après le MVP |

## Modules (code)

| Page | Résumé |
|---|---|
| [[kernel]] | Identifiants typés, Result, ExecutionContext, ports, AccessPolicy |
| [[contracts]] | Permissions, registre d'actions, événements, client identity |
| [[ops]] | Configuration, journal, HTTP, base, migrateur, secrets, chaîne d'écriture |
| [[ui]] | Façade DSFR (`AppShell`, thème) |
| [[identity]] | Organisations, utilisateurs, sessions, MFA, rôles, clés API |
| [[policy]] | Projection des attributions et décision d'autorisation |
| [[portfolio]] | Projets, cycle de vie, équipes, purge |
| [[workflow]] | Packs méthodologiques, workflows versionnés |
| [[workitem]] | Éléments, hiérarchie, transitions, rang, commentaires |
| [[query]] | Backlog, board, recherche, journal d'activité |
| [[audit]] | Journal chaîné SHA-256 |
| [[event-relay]] | Relais des outbox |
| [[api-gateway]] | Routes générées, authentification, CSRF |
| [[web]] | Interface React + DSFR |
| [[pv-app-et-compose]] | Unité de déploiement, image, composition |
| [[outillage]] | `tools/` : référence, fumée, contrôle du modèle de PR |

## Concepts

| Page | Résumé |
|---|---|
| [[architecture-en-couches]] | fonctionnel / structure / OPS, aucun import entre services |
| [[chaine-d-ecriture]] | Action → validation → transaction → outbox → relais |
| [[base-et-rls]] | Schéma par service, rôles PostgreSQL, RLS forcée |
| [[autorisation]] | RBAC, refus explicites, niveaux de risque R0–R3 |
| [[authentification]] | Sessions, CSRF, TOTP, clés `pvb_key_` |
| [[audit-chaine]] | Chaîne de hachage par organisation |
| [[interface-dsfr]] | DSFR thème neutre, CSP, accessibilité |
| [[audit-zap]] | Audit DAST OWASP ZAP (RI-SEC-15) : pile locale, CI, recette passive ; triage, historique |
| [[audit-semgrep]] | Audit Semgrep avant chaque livraison (RI-SEC-14), triage, historique des audits |
| [[regles-immuables-essentiel]] | Les règles qui reviennent le plus souvent en pratique |

## Décisions

| Page | Résumé |
|---|---|
| [[registre-des-adr]] | ADR-0001 à 0010 : statut et décision en une ligne |
| [[journal-des-decisions]] | Choix du mainteneur pris en conversation (hors ADR) |

## GitHub

| Page | Résumé |
|---|---|
| [[etat-des-stories]] | Statut de chaque story par lot (page générée) |
| [[historique-des-pr]] | PR fusionnées, contenu, incidents |
| [[processus-github]] | Projet n° 2, champs, étiquettes, modèles, CI, signature |

## Exploitation

| Page | Résumé |
|---|---|
| [[recette-coolify]] | Déploiement de la recette, procédure, pièges |
| [[poste-de-developpement]] | Contournements du poste (disque D:, Node, pnpm, signature) |

## Leçons

| Page | Résumé |
|---|---|
| [[lecons-apprises]] | Incidents et erreurs à ne pas répéter |

## Sources

| Page | Résumé |
|---|---|
| [[catalogue-des-sources]] | Sources brutes et où les lire |
| [[2026-10-01-audit-zap-initial]] | Rapport du premier audit ZAP (local et recette) |
| [[2026-10-01-audit-semgrep-initial]] | Rapport du premier audit Semgrep complet (constats et suites) |
| [[2026-10-01-decisions-du-mainteneur]] | Instantané des consignes et choix du mainteneur (sessions du 29/09 au 01/10/2026) |
