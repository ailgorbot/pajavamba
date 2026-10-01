---
type: module
mise_a_jour: 2026-10-01
---

# api-gateway

- **Où** : `services/api-gateway` — Passerelle HTTP (sans schéma).
- **Contenu** : Routes `/api/v1` générées depuis le registre d’actions, authentification cookie ou clé, CSRF, refus des jetons dans l’URL, contexte d’exécution.
- **Voir** : [[chaine-d-ecriture]], [[authentification]]. Tests unitaires : aucun (dette, seuls les tests de fumée couvrent le parcours).
