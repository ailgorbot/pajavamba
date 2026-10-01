---
type: lot
mise_a_jour: 2026-10-01
sources: [PR #251, #253, #255, CHANGELOG.md, services/workflow, services/workitem, services/query]
---

# Lot 3 — Éléments et workflows (0.4.0, MVP)

**Résultat vérifiable attendu** : création, hiérarchie, transitions, board accessible au clavier.

## Livré (PR #251, complément #253)

- [[workflow]] : packs Scrum, Kanban, Scrumban, Personnalisé ; versions publiées immuables.
- [[workitem]] : création, hiérarchie contrôlée, transitions, assignation, rang, commentaires, historique, corbeille, confidentialité.
- [[query]] : backlog, board, recherche plein texte française, journal d'activité (projections alimentées par événements).
- [[web]] : backlog, board au clavier, détail d'élément.

## Partiel ou reporté

| Story | Reste à faire |
|---|---|
| L3-12 (#94) | Observateurs et étiquettes (assignation livrée) |
| L3-14 (#96) | Mentions (commentaires livrés) |
| L3-33 (#115) | Documentation du lot |
| Backlog | L3-04 migration de version de workflow, L3-13 champs personnalisés, L3-15 relations, L3-19 opérations en masse, L3-20 déplacement entre projets, L3-22 configuration de la hiérarchie, L3-29 éditeur de workflow, L3-31 temps réel, L3-32 raccourcis et palette |

La fusion de #251 a cassé `tools/smoke` (conflit mal résolu), réparé par #255 : [[lecons-apprises]].
