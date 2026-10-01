---
type: module
mise_a_jour: 2026-10-01
---

# event-relay

- **Où** : `services/event-relay` — Relais des outbox (schéma `events`, migration `0001_socle.sql` qui crée aussi `pv_ops`).
- **Contenu** : Relais en processus, réveillé après chaque transaction et chaque seconde ; lettres mortes.
- **Voir** : [[chaine-d-ecriture]]. Tests unitaires : aucun (dette, seuls les tests de fumée couvrent le parcours).
