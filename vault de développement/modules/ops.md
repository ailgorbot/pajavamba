---
type: module
mise_a_jour: 2026-10-01
---

# ops

- **Où** : `packages/ops` — Couche haute (OPS), zone protégée.
- **Contenu** : `loadConfig`, catalogue de journalisation et logger pino, `HttpProblem` (RFC 9457), `registerHooks`/`registerProbes`, `withTransaction`, migrateur, secrets (uuidv7, jetons, HMAC, argon2, `encryptField`), `executeWrite`, `consumeOnce`, `action-kit`, `serviceWrite`/`serviceRead`.
- **Voir** : [[chaine-d-ecriture]], [[base-et-rls]], [[authentification]]. Tests unitaires : aucun (dette, seuls les tests de fumée couvrent le parcours).
