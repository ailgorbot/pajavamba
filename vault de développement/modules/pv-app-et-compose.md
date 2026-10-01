---
type: module
mise_a_jour: 2026-10-01
---

# pv-app-et-compose

- **Où** : `deploy/` — Unité de déploiement unique et image.
- **Contenu** : `deploy/units/pv-app` : `main.ts` (câblage de tous les services, relais), `settings.ts`, `init-secrets.ts`, `migrate.ts` ; `deploy/compose` : `Dockerfile` (non root, lecture seule), `compose.yaml` (`pv-init`, `pv-db`, `pv-migrate`, `pv-app`, volumes `pv-secrets`, `pv-db-data`).
- **Cache** : `web-cache.ts` fixe `cache-control` des fichiers de l'interface (#279), testé dans `deploy/units/pv-app/tests/`.
- **Voir** : [[recette-coolify]], [[base-et-rls]]. Vérifié par le job « Pile conteneurisée » de la CI.
