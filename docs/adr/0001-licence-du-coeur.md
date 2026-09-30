---
titre: ADR-0001 — Licence du cœur
public: mainteneurs
statut: proposée
version_min: 0.1.0
mise_a_jour: 2026-09-30
---

# ADR-0001 — Licence du cœur

| Élément | Valeur |
|---|---|
| Statut | **Proposée** — décision des mainteneurs en attente |
| Story | [L0-03](https://github.com/ailgorbot/pajavamba/issues/3) |
| Références | H09, C01, RI-GIT-05 |

## Contexte

RI-GIT-05 exige un fichier `LICENSE`. Deux options sont envisagées pour le cœur de PajaVamba.

## Options

| Option | Avantages | Inconvénients |
|---|---|---|
| AGPL-3.0 | Toute version modifiée exploitée en service doit publier ses sources ; cohérent avec un usage public | Frein possible pour certaines intégrations propriétaires |
| Apache-2.0 | Permissive, concession de brevets explicite, adoption facilitée | Pas d'obligation de réciprocité |

## Décision

Non prise à la date du MVP 0.4.0 : aucun fichier `LICENSE` n'est ajouté tant que les mainteneurs n'ont pas tranché. Le contrôle RI-GIT-05 reste donc ouvert.

## Conséquences

La première PR de gouvernance (L0-08) ajoutera `LICENSE` dès la décision.
