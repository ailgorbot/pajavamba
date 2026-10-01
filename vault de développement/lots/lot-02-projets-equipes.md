---
type: lot
mise_a_jour: 2026-10-01
sources: [PR #250, #252, CHANGELOG.md, services/portfolio, apps/web]
---

# Lot 2 — Projets et équipes (cible 0.3.0, livré dans le MVP 0.4.0)

**Résultat vérifiable attendu** : création → activation → clôture → archivage → suppression.

## Livré (PR #250, complément #252)

- [[portfolio]] : projet créé en brouillon, activation, assistant de clôture, réouverture, archivage, suppression programmée puis purge ; équipes et membres ; événements consommés par [[policy]], [[query]] et [[audit]].
- Référence de projet (clé ou identifiant) analysée par `parseProjectRef` ([[kernel]]).
- [[web]] : liste des projets, page projet à onglets, administration de projet.

## Partiel ou reporté

| Story | Reste à faire |
|---|---|
| L2-20 (#82) | Documentation du lot (guide « Premier projet », fiche `portfolio`) |
| Backlog | L2-14 portefeuilles, trains et produits ; L2-15 politique de clés par projet ; L2-19 test de montée de version et de retour arrière en recette |

#250 et #252 portent le même lot (branche empilée fusionnée deux fois) : voir [[historique-des-pr]].
