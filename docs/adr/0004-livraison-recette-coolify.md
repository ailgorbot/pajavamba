---
titre: ADR-0004 — Livraison de la recette sur Coolify
public: exploitants, mainteneurs
statut: acceptée
version_min: 0.4.0
mise_a_jour: 2026-09-30
---

# ADR-0004 — Livraison de la recette sur Coolify

| Élément | Valeur |
|---|---|
| Statut | Acceptée pour la recette du MVP (revue par les mainteneurs attendue) |
| Story | [L0-06](https://github.com/ailgorbot/pajavamba/issues/6), [L0-34](https://github.com/ailgorbot/pajavamba/issues/34) |
| Références | §7 de la décomposition, RI-SCR-01, RI-SCR-07, RI-SEC-10, RI-VER-04, RI-VER-07 |

## Contexte

La recette est hébergée sur un VPS piloté par Coolify 4. La chaîne cible (§7.2) publie des images signées sur GHCR puis déploie un tag figé ; elle n'existe pas encore au MVP.

## Décision

1. **Ressource Coolify de type Docker Compose** issue de `deploy/compose/compose.yaml`, sur la branche de livraison.
2. **Écart temporaire** : l'image `pv-app` est construite par Coolify sur le VPS à partir du `Dockerfile` (commit figé), en attendant `release.yml` (publication GHCR, cosign, SBOM). Aucun secret n'est présent dans le contexte de construction (`.dockerignore`).
3. **Secrets** : générés au premier démarrage par le service `pv-init` dans le volume nommé `pv-secrets` (mot de passe d'administration PostgreSQL, mot de passe du rôle d'exécution, poivre, clé de chiffrement des champs, code d'initialisation). Ils sont lus en fichiers `*_FILE` ; aucune variable d'environnement ne porte de secret ; aucun secret par défaut.
4. **Ordre de démarrage** : `pv-init` → `pv-db` (sonde `pg_isready`) → `pv-migrate` (migrations, rôle `pv_runtime` sans `BYPASSRLS`) → `pv-app` (sonde `/readyz`).
5. **Réseau** : seul `pv-app` est routé par le proxy de Coolify en HTTPS ; PostgreSQL reste sur le réseau interne ; les plages privées sont déclarées proxys de confiance.
6. **Conteneurs** : utilisateur non root (`node`), système de fichiers en lecture seule, `/tmp` en mémoire.

## Retour arrière

Les migrations vont vers l'avant uniquement : le retour arrière restaure la sauvegarde de `pv-db-data` prise avant le déploiement, puis redéploie le commit précédent (runbook : `docs/exploitation/deploiement-coolify.md`).

## Conséquences

- Coolify pilote un démon de conteneurs classique : propre à la recette, hors livrables portables (point de vigilance n° 8).
- La construction sur le VPS sera remplacée par des images GHCR signées (story L0-34).
