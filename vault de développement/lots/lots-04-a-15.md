---
type: lot
mise_a_jour: 2026-10-01
sources: [docs/developpeur/contribuer/decomposition-du-developpement.md §6.2, §6.4, §10]
---

# Lots 4 à 15 — feuille de route

Aucune story commencée (voir [[etat-des-stories]]).

| Lot | Version | Contenu principal |
|---|---|---|
| 4 Planification | 0.5.0 | `planning` (sprints, capacité, WIP), burndown, vélocité, `notification`, `delivery` |
| 5 Intégration | 0.6.0 | API complète, OpenAPI/Swagger, webhooks, SSE, SDK, `mcp-gateway`, `approval`, `files`, import/export CSV |
| 6 OpenFox | 0.7.0 | `openfox-adapter`, `context-gateway`, `llm-egress-proxy`, `pv-pii`, panneau assistant |
| 7 Livraison | 1.0.0 | Archives Windows/Linux/macOS, superviseur, manuels, audit RGAA, test d'intrusion |
| 8 | 1.1.0 | Dépendances, risques ROAM, PVQL |
| 9 | 1.2.0 | SAFe, roadmap, métriques de flux |
| 10 | 1.3.0 | Automatisations, intégrations Git/CI, extensions iframe |
| 11 | 1.4.0 | SAML, SCIM, élévation temporaire, revue des accès |
| 12 | 1.5.0 | Imports Jira/Taiga, exports ODS/XLSX, recherche sémantique, Helm |
| 13 | 1.6.0 | Portefeuille avancé, budgets, OKR |
| 14 | 1.7.0 | `plugin-host` WASM |
| 15 | 1.8.0 | PWA hors ligne, anglais, base dédiée, broker |

## Préalables (§10 de la décomposition)

- Avant le lot 6 : contrat d'OpenFox. Avant le lot 7 : certificats de signature, source des binaires PostgreSQL portables, test d'intrusion indépendant.
- Avant toute diffusion publique : vérification du nom, de la marque et du terme SAFe.
- Le MVP regroupe les services dans `pv-app` (écart E3 d'ADR-0006) : la scission en unités se décidera selon la charge.
