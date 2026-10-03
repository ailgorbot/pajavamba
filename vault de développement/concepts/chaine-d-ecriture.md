---
type: concept
mise_a_jour: 2026-10-01
sources: [packages/contracts/src/actions.ts, packages/ops/src/write-pipeline.ts, packages/ops/src/service-runtime.ts, services/api-gateway, docs/developpeur/contribuer/architecture-du-code.md]
---

# Chaîne d'écriture

1. **Déclaration** : chaque action est déclarée par `defineAction` ([[contracts]]) : méthode, chemin, permission, niveau de risque, règles. Le registre produit les routes de [[api-gateway]] et la référence `docs/reference/actions.md` (56 actions au MVP, `pnpm reference:check` en CI).
2. **Entrée** : la passerelle authentifie (cookie + CSRF ou clé), refuse un jeton dans l'URL, construit l'`ExecutionContext` et transmet un `ActionCall`.
3. **Validation** : schéma Zod fermé (`parseInput`), `If-Match` pour les modifications (`requireIfMatch`), `Idempotency-Key` obligatoire sur les `POST` et `dryRun` (RI-API-05) ; en-tête manquant → 428 `request.precondition_required` (code du catalogue des spécifications). Une réponse est rejouée pendant 24 h pour la même clé ; au-delà, la clé peut resservir (L0-23).
4. **Transaction** (`serviceWrite` → `executeWrite`, [[ops]]) : `BEGIN`, `SET ROLE pv_<s>_app`, `app.organisation_id` pour la RLS ([[base-et-rls]]), cas d'usage, écriture de l'agrégat, de l'outbox (`kind` = `event` ou `audit`) et de la clé d'idempotence, `COMMIT`.
5. **Relais** : [[event-relay]] lit les outbox dans l'ordre et livre des CloudEvents aux consommateurs (`consumeOnce` + `processed_events` pour l'idempotence). Consommateurs : [[policy]], [[query]], [[audit]], [[identity]], [[portfolio]].
6. **Réponse** : statut, corps, `ETag` ; erreurs au format RFC 9457 (`HttpProblem`, `domain-problem`).

Lecture : `serviceRead` (même portée RLS, sans outbox). Un refus d'autorisation est audité (RI-HAB-12).

Pour ajouter une action : déclarer, implémenter le cas d'usage dans `fonctionnel`, l'action dans `structure/src/actions`, puis `pnpm reference`.
