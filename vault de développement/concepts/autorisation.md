---
type: concept
mise_a_jour: 2026-10-01
sources: [packages/kernel/src/ports.ts, packages/contracts/src/permissions.ts, services/policy, ADR-0006 E1]
---

# Autorisation

- Port `AccessPolicy` ([[kernel]]) : `authorize(contexte, requête)` → autorisé ou refus motivé (`no_grant`, `explicit_deny`, `r3_requires_ui_mfa`, `read_only_credential`) ; `projectsWith` → portée de projets (`ProjectScope`). Aide : `requireAccess` ; erreurs `FORBIDDEN` et `NOT_FOUND` (une ressource non accessible apparaît inexistante).
- Catalogue des permissions : `PERMISSIONS` dans [[contracts]] ; rôles par portée (organisation, projet) dans `roles.catalog.ts` d'[[identity]].
- Niveaux de risque : **R0** lecture, **R1** écriture réversible, **R2** écriture sensible, **R3** administration — R3 exige l'interface (pas de clé API) et une MFA de moins de 15 minutes.
- Décision par [[policy]] (TypeScript) sur une **projection locale** des attributions, alimentée par les événements d'identity et de portfolio : RBAC, refus explicites prioritaires, clé en lecture seule. Cedar/WASM reportés (L1-03 à L1-05).
- Les refus sont audités ([[audit-chaine]]).
