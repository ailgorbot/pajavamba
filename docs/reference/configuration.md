---
titre: Référence de la configuration
public: développeurs, exploitants
statut: généré
version_min: 0.4.0
---

# Référence de la configuration

> Document **généré** par `tools/reference/generate-catalogs.ts` depuis les schémas de configuration de `deploy/units/pv-app` (RI-DOC-03). Ne pas modifier à la main.

Toute variable peut être fournie en fichier par la variante `_FILE`, qui prévaut ; les secrets ne sont acceptés que sous cette forme en production (RI-SCR-01). Une configuration invalide arrête le service au démarrage en citant les seuls noms des variables fautives.

## Unité `pv-app`

| Variable | Défaut | Rôle |
|---|---|---|
| `PV_APP_HOST` | `127.0.0.1` | Adresse d’écoute HTTP |
| `PV_APP_PORT` | `8080` | Port d’écoute HTTP |
| `PV_APP_DB_HOST` | `127.0.0.1` | Hôte PostgreSQL |
| `PV_APP_DB_PORT` | `5432` | Port PostgreSQL |
| `PV_APP_DB_NAME` | `pajavamba` | Base PostgreSQL |
| `PV_APP_DB_USER` | `pv_runtime` | Rôle PostgreSQL d’exécution (sans `BYPASSRLS`) |
| `PV_APP_DB_PASSWORD_FILE` (secret en fichier) | — (obligatoire) | Mot de passe du rôle d’exécution |
| `PV_APP_DB_POOL_MAX` | `20` | Connexions PostgreSQL maximales du pool (RI-PRF-04) |
| `PV_APP_PEPPER_FILE` (secret en fichier) | — (obligatoire) | Poivre HMAC des jetons et clés API |
| `PV_APP_SETUP_CODE_FILE` (secret en fichier) | — (obligatoire) | Code d’initialisation de l’instance |
| `PV_APP_FIELD_KEY_FILE` (secret en fichier) | — (obligatoire) | Clé de chiffrement des champs sensibles (AES-256-GCM) |
| `PV_APP_SECURE_COOKIES` | `true` | Cookie de session `__Host-` sécurisé (HTTPS obligatoire) |
| `PV_APP_HTTPS` | `true` | Service derrière HTTPS : en-tête HSTS |
| `PV_APP_TRUSTED_PROXIES` | (vide) | Proxys de confiance pour `X-Forwarded-For` (liste séparée par des virgules) |
| `PV_APP_WEB_DIR` | (vide) | Répertoire de l’interface compilée (vide : pas d’interface) |
| `PV_APP_LOG_DETAIL` | `technical` | Niveau de détail du journal |
| `PV_APP_PURGE_INTERVAL_MINUTES` | `60` | Intervalle de la purge des projets supprimés (minutes) |

## Migrateur `pv-migrate`

| Variable | Défaut | Rôle |
|---|---|---|
| `PV_MIGRATE_DB_HOST` | `127.0.0.1` | Hôte PostgreSQL |
| `PV_MIGRATE_DB_PORT` | `5432` | Port PostgreSQL |
| `PV_MIGRATE_DB_NAME` | `pajavamba` | Base PostgreSQL |
| `PV_MIGRATE_DB_ADMIN_USER` | `postgres` | Superutilisateur PostgreSQL du migrateur |
| `PV_MIGRATE_DB_ADMIN_PASSWORD_FILE` (secret en fichier) | — (obligatoire) | Mot de passe du superutilisateur |
| `PV_MIGRATE_RUNTIME_PASSWORD_FILE` (secret en fichier) | — (obligatoire) | Mot de passe attribué au rôle d’exécution |
