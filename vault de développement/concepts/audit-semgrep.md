---
type: concept
mise_a_jour: 2026-10-01
sources: [docs/adr/0008-audit-semgrep-a-chaque-livraison.md, tools/semgrep/audit-semgrep.ts, .semgrep/, .github/workflows/security.yml, "[[2026-10-01-audit-semgrep-initial]]"]
---

# Audit Semgrep

Règle **RI-SEC-14** (ADR-0008) : aucun code n'est poussé sur GitHub sans audit Semgrep complet et sans traitement de chaque constat.

## Deux niveaux

| Niveau | Quand | Règles | Bloquant |
|---|---|---|---|
| CI `security.yml` | Chaque PR, `main`, chaque lundi | Règles du projet `.semgrep/regles-projet.yml` (+ tests des règles) | Oui |
| CI planifiée (#273) | Chaque lundi et à la demande (`workflow_dispatch`) | Même script que l'audit de livraison | Oui (job « Audit Semgrep officiel ») |
| Audit de livraison | Avant chaque poussée, par l'auteur | Règles du projet + 9 jeux officiels (`REGISTRY_RULESETS` dans `tools/semgrep/audit-semgrep.ts`) | Oui, par processus |

Commande : `pnpm audit:semgrep` (Docker ; image `semgrep/semgrep:1.178.0` épinglée par empreinte, déjà présente sur [[poste-de-developpement]]).

Sans Docker sur le poste : même script dans la CI (`gh workflow run security.yml --ref <branche>`, job « Audit Semgrep officiel ») avant d'ouvrir la PR.

## Triage d'un constat

1. **Confirmé** → issue « [Semgrep] … » (jalon, étiquettes, projet n° 2) → PR de correction avec test.
2. **Faux positif** → `// nosemgrep: <règle>` précédé de la justification, consigné dans une issue.
3. **Vulnérabilité exploitable** → avis de sécurité privé (RI-SEC-12), jamais d'issue publique.
4. **Erreur d'analyse** → corriger le fichier (un fichier non analysé est un angle mort).

Après l'audit : entrée `audit` dans [[log]] et mise à jour de cette page.

## Règles du projet

| Règle | Détecte | Note |
|---|---|---|
| `pv-sql-concatenation` | SQL concaténé ou interpolé (sauf constantes MAJUSCULES) dans `.query(…)` / `.query<T>(…)` | Motifs textuels : le parseur TypeScript de Semgrep lit mal les appels génériques |
| `pv-journal-hors-catalogue` | `console.*` dans le code livré | Journal catalogué de [[ops]] |
| `pv-evaluation-dynamique` | `eval`, `new Function` | — |

Tests : `semgrep --test --config .semgrep/regles-projet.yml .semgrep/regles-projet.ts` (passer un dossier ne lance aucun test).

## Historique des audits

| Date | Bilan | Suites |
|---|---|---|
| 01/10/2026 | 6 constats, 2 erreurs d'analyse (jeux officiels) ; 11 interpolations SQL (règles du projet) | #265, #266, #267 ; requêtes littérales dans #264. Détail : [[2026-10-01-audit-semgrep-initial]] |
| 01/10/2026 (après #264 à #272) | 0 constat, 0 erreur d'analyse sur `main` (`1a53b40`) | — |

Voir aussi [[base-et-rls]], [[processus-github]], [[lecons-apprises]].
