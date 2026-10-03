---
type: module
mise_a_jour: 2026-10-01
---

# api-gateway

- **Où** : `services/api-gateway` — Passerelle HTTP (sans schéma).
- **Contenu** : Routes `/api/v1` générées depuis le registre d’actions, authentification cookie ou clé, CSRF, refus des jetons dans l’URL, contexte d’exécution.
- **Limitation de débit** (L0-23, RI-API-11) : 600 lectures et 120 écritures par minute et par client (utilisateur et type d'accès, ou adresse IP sans authentification), plafond ×10 par organisation ; en-têtes `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, refus 429 `request.rate_limited` avec `Retry-After`. Compteurs en mémoire de l'unité (`createRateLimiter` d'OPS) : magasin partagé à prévoir avec plusieurs instances.
- **Voir** : [[chaine-d-ecriture]], [[authentification]]. Tests unitaires : aucun (dette, seuls les tests de fumée couvrent le parcours).
