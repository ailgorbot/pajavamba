---
titre: ADR-0002 — Versions figées de Node.js, PostgreSQL et TypeScript
public: développeurs, exploitants
statut: acceptée
version_min: 0.4.0
mise_a_jour: 2026-09-30
---

# ADR-0002 — Versions figées

| Élément | Valeur |
|---|---|
| Statut | Acceptée pour le MVP 0.4.0 (revue par les mainteneurs attendue) |
| Story | [L0-04](https://github.com/ailgorbot/pajavamba/issues/4) |
| Références | H11, RI-COD-10, RI-ARC-12 |

## Décision

| Composant | Version | Justification |
|---|---|---|
| Node.js | 24 (LTS active) | Suppression native des types TypeScript : les services s'exécutent sans transpileur |
| PostgreSQL | 18 | Version stable courante ; extensions `citext`, `unaccent`, `pg_trgm`, `ltree` |
| TypeScript | 6.0.3 | Dernière version compatible avec `typescript-eslint` 8.71 (TypeScript 7 natif non encore supporté) |
| pnpm | 10.34.6 | Installation figée (`--frozen-lockfile`) |
| Rust | non introduit | RI-ARC-13 : aucun besoin justifié dans le MVP (voir ADR-0006) |

Toutes les dépendances sont épinglées à une version exacte (`save-exact`) et verrouillées par `pnpm-lock.yaml`.

## Conséquences

- Les services TypeScript respectent `erasableSyntaxOnly` (ni `enum`, ni `namespace`, déjà interdits par RI-COD-02).
- Toute montée de version majeure passe par une nouvelle ADR.
