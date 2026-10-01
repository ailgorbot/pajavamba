---
type: concept
mise_a_jour: 2026-10-01
sources: [services/*/structure/migrations/, packages/ops/src/database.ts, packages/ops/src/migrator.ts, deploy/units/pv-app/src/migrate.ts]
---

# Base de données et RLS

- PostgreSQL 18 ; **un schéma par service**, seul propriétaire de ses tables (RI-SRV-01) ; rôle applicatif `pv_<s>_app` par service.
- Rôle de connexion `pv_runtime` **sans `BYPASSRLS`** ; chaque transaction fait `SET ROLE` vers le rôle du service.
- RLS **forcée** sur les tables métier, filtrée par le paramètre de session `app.organisation_id` (posé par `withTransaction`).
- Tables communes créées par `pv_ops.create_service_tables()` : outbox (événements et audit), `idempotency_keys`, `processed_events`.
- Migrations : `services/<s>/structure/migrations/NNNN_*.sql`, vers l'avant uniquement (RI-DON-04), appliquées par le conteneur `pv-migrate` ([[pv-app-et-compose]]) via `applyOne`/`applySet` ([[ops]]). Une seule migration `0001_*` par service au MVP.
- SQL **exclusivement paramétré** avec `pg` (pas de Kysely, écart E2 d'ADR-0006).
- Champs sensibles chiffrés (`encryptField`, clé `field_key`).

Piège connu : une écriture faite avant que l'organisation existe est bloquée par la RLS (initialisation) → préallouer l'`organisationId` dans le gestionnaire. Voir [[lecons-apprises]].
