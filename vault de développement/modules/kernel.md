---
type: module
mise_a_jour: 2026-10-01
---

# kernel

- **Où** : `packages/kernel` — Noyau partagé, sans dépendance d’exécution.
- **Contenu** : Identifiants typés (`ids.ts`, base58), `Result`, `DomainError`, `DomainEvent`, `ExecutionContext` (avec `Credential`), ports `Clock`, `IdGenerator`, `AccessPolicy` + `requireAccess`, `FORBIDDEN`/`NOT_FOUND`, `parseProjectRef`.
- **Voir** : [[autorisation]], [[architecture-en-couches]]. Tests unitaires : aucun (dette, seuls les tests de fumée couvrent le parcours).
