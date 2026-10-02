---
type: concept
mise_a_jour: 2026-10-01
sources: [docs/adr/0010-audit-dast-owasp-zap.md, tools/zap/audit-zap.ts, .zap/, .github/workflows/ci.yml, .github/workflows/security.yml, "[[2026-10-01-audit-zap-initial]]"]
---

# Audit DAST OWASP ZAP

Règle **RI-SEC-15** (ADR-0010) : pendant applicatif de l'[[audit-semgrep]]. Semgrep lit le code, ZAP interroge l'application démarrée (en-têtes, cookies, erreurs, divulgations, configuration réelle).

## Trois niveaux

| Niveau | Quand | Cible | Mode |
|---|---|---|---|
| Audit de livraison | Avant chaque poussée qui modifie `apps/`, `services/`, `packages/`, `deploy/` | Pile locale éphémère `pvzap` (créée puis supprimée) | Passif + spider AJAX |
| CI `ci.yml` (job « Pile conteneurisée ») | Chaque PR et `main` | Pile éphémère `ci` | Passif, bloquant |
| CI `security.yml` (job « DAST actif ») | Chaque lundi et à la demande | Pile éphémère `dast` | **Actif** (attaques simulées, 45 min max) |
| Recette | À chaque livraison de lot | Adresse de la recette (note locale `local/recette.md`) | **Passif uniquement** (le script refuse `--actif` hors réseau Docker) |

Commande : `pnpm audit:zap` ; recette : `pnpm audit:zap -- --cible <adresse>` ; rapport JSON local dans `.zap/rapports/` (non versionné).

## Triage

1. **Confirmé** → issue « [ZAP] … » → correction avec test (et nouvelle analyse).
2. **Faux positif** : règle entière sans objet → `.zap/regles.tsv` (`IGNORE`, justification en commentaire) ; paramètre précis → `.zap/faux-positifs.tsv` (la règle reste active pour les autres paramètres).
3. **Vulnérabilité exploitable** → avis de sécurité privé (RI-SEC-12).

Les alertes « Information » comptent aussi : elles se trient comme les autres.

## Pièges

- Sur ce poste, la pile `pvtest` occupe le port 18080 ; `audit:zap` n'expose aucun port (réseau Docker interne), mais les tests de fumée locaux doivent choisir un autre port.
- Sous Git Bash : `MSYS_NO_PATHCONV=1` pour `docker compose exec … cat /secrets/setup_code`.
- ZAP voit ce qu'un visiteur non connecté voit : parcours authentifiés et API à couvrir (#280).

## Historique des audits

| Date | Cible | Bilan | Suites |
|---|---|---|---|
| 01/10/2026 | Pile locale | 3 alertes, puis une régression 500 détectée pendant la correction ; 0 après corrections | #278, #279 ; faux positifs justifiés. Détail : [[2026-10-01-audit-zap-initial]] |
| 01/10/2026 | Recette (passif) | 2 alertes (COEP, cache) sur la version déployée | Couvertes par #278 et #279 ; à réanalyser après déploiement |
| 02/10/2026 | Recette (passif), après redéploiement de `e799ced` | COEP et cache corrigés ; 1 alerte 10015 (directives de cache, HTTPS seulement) | Faux positif justifié (#285) |

Voir aussi [[interface-dsfr]], [[pv-app-et-compose]], [[recette-coolify]], [[lecons-apprises]].
