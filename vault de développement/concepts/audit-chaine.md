---
type: concept
mise_a_jour: 2026-10-01
sources: [services/audit/fonctionnel/src/domaine/audit-chain.ts, services/audit/structure, ADR-0006 E6]
---

# Audit chaîné

- Chaque service écrit ses entrées d'audit dans son outbox, dans la même transaction que l'agrégat (RI-AUD-01) ; [[event-relay]] les livre à [[audit]].
- [[audit]] les chaîne par **SHA-256, une chaîne par organisation** ; les actions hors organisation (connexion, initialisation) vont dans une **chaîne d'instance** d'identifiant `00000000-…`.
- Vérification : `GET /audit/verification` recalcule la chaîne et signale la première rupture.
- Ancrage externe de la chaîne reporté (L1-12).
