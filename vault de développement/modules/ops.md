---
type: module
mise_a_jour: 2026-10-01
---

# ops

- **Où** : `packages/ops` — Couche haute (OPS), zone protégée.
- **Contenu** : `loadConfig`, catalogue de journalisation et logger pino, `HttpProblem` (RFC 9457), `registerHooks`/`registerProbes`, `withTransaction`, migrateur, secrets (uuidv7, jetons, HMAC, argon2, `encryptField`), `executeWrite`, `consumeOnce`, `action-kit`, `serviceWrite`/`serviceRead`.
- **Client HTTP sortant** : `createHttpClient` (délai par tentative, reprises bornées à 3 pour les requêtes rejouables, disjoncteur → 503 `system.unavailable`) ; tout `fetch` direct hors de ce client est refusé par la règle Semgrep `pv-appel-sortant-direct` (L0-23).
- **Sécurité** : `decryptField`/`encryptField` imposent une étiquette AES-GCM de 16 octets (#265) ; premiers tests unitaires `packages/ops/tests/` (PR #268).
- **Voir** : [[chaine-d-ecriture]], [[base-et-rls]], [[authentification]]. Tests unitaires : aucun (dette, seuls les tests de fumée couvrent le parcours).
