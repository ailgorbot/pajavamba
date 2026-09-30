---
titre: ADR-0003 — Portées de commit et conventions Git
public: développeurs
statut: acceptée
version_min: 0.1.0
mise_a_jour: 2026-09-30
---

# ADR-0003 — Portées de commit et conventions Git

| Élément | Valeur |
|---|---|
| Statut | Acceptée pour le MVP 0.4.0 (revue par les mainteneurs attendue) |
| Story | [L0-05](https://github.com/ailgorbot/pajavamba/issues/5) |
| Références | RI-NOM-09, RI-REV-07, RI-VER-01 |

## Décision

- Commits Conventional Commits : type en anglais (`feat`, `fix`, `docs`, `refactor`, `test`, `ci`, `build`, `chore`), description en français.
- Portées : le nom du service (`identity`, `portfolio`, `workflow`, `workitem`, `query`, `audit`, `policy`, `event-relay`, `api-gateway`, `web`) ou une portée transverse : `socle`, `docs`, `ci`, `deploy`, `ui`.
- Branches : `<type>/<ticket>-<description>` (ex. `feat/L3-11-transitions`).
- Fusion par squash, historique linéaire, commits signés.

## Conséquences

Le changelog et les étiquettes de version sont générés à partir des messages de commit.
