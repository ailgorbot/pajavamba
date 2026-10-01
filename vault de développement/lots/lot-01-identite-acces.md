---
type: lot
mise_a_jour: 2026-10-01
sources: [PR #248, ADR-0006, CHANGELOG.md, services/identity, services/policy]
---

# Lot 1 — Identité et accès (cible 0.2.0, livré dans le MVP 0.4.0)

**Résultat vérifiable attendu** : connexion, attribution de rôle, appel API clé + projet, refus audités.

## Livré (PR #248)

- [[identity]] : initialisation de l'instance par code à usage unique, comptes locaux argon2id, sessions et CSRF, ralentissement des échecs, TOTP et codes de récupération, invitations, désactivation avec révocation immédiate, rôles par portée et refus explicites, clé API personnelle `pvb_key_`. Voir [[authentification]].
- [[policy]] : décision locale en TypeScript sur une projection des attributions (écart E1 d'ADR-0006 : ni Rust ni Cedar). Voir [[autorisation]].
- [[audit]] : chaîne SHA-256 par organisation, chaîne d'instance pour les actions hors organisation. Voir [[audit-chaine]].
- [[event-relay]] : relais d'outbox en processus (écart E4).
- [[api-gateway]] : routes générées, authentification, CSRF, jeton dans l'URL refusé.
- Interface : connexion, initialisation, profil (MFA, clé), administration.

## Partiel ou reporté

| Story | Reste à faire |
|---|---|
| L1-10 (#45) | Groupes |
| L1-19 (#54) | WebAuthn, politique MFA d'organisation (TOTP et MFA récente livrés) |
| L1-27 (#62) | Documentation complète du lot (fiches DAD, authentification API) |
| Backlog | L1-03 à L1-05 (Cedar, WASM), L1-16 jeton court, L1-17 comptes de service, L1-20 OAuth 2.1, L1-21 OIDC, L1-22 compte de secours, L1-23 politiques d'organisation |

Pièges rencontrés (RLS à l'initialisation, compteur d'échecs annulé par le retour arrière de transaction) : [[lecons-apprises]].
