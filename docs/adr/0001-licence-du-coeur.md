---
titre: ADR-0001 — Licence du cœur
public: mainteneurs
statut: acceptée
version_min: 0.1.0
mise_a_jour: 2026-09-30
---

# ADR-0001 — Licence du cœur

| Élément | Valeur |
|---|---|
| Statut | **Acceptée** le 30/09/2026 par le mainteneur |
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

Le cœur de PajaVamba est publié sous licence **Apache-2.0**. Le texte officiel figure dans le fichier `LICENSE` à la racine du dépôt.

## Conséquences

- RI-GIT-05 : le fichier `LICENSE` est présent.
- Toute dépendance ajoutée doit être compatible avec Apache-2.0 (contrôle de licence de RI-COD-10).
- Les contributions sont acceptées sous la même licence (à préciser dans `CONTRIBUTING`, story L0-08).
