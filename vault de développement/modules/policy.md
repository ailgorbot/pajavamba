---
type: module
mise_a_jour: 2026-10-01
---

# policy

- **Où** : `services/policy` — Décision d’autorisation locale (schéma `policy`).
- **Contenu** : `decision.ts` (RBAC, refus explicites, R3), projection des attributions alimentée par les événements d’identity, adaptateur `AccessPolicy` utilisé par tous les services.
- **Voir** : [[autorisation]]. Tests : `fonctionnel/tests/decision.test.ts` (seul test unitaire de service).
