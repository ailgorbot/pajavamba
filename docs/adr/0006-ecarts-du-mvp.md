---
titre: ADR-0006 — Écarts assumés du MVP 0.4.0 par rapport aux spécifications
public: mainteneurs, développeurs
statut: proposée
version_min: 0.4.0
mise_a_jour: 2026-09-30
---

# ADR-0006 — Écarts assumés du MVP 0.4.0

| Élément | Valeur |
|---|---|
| Statut | **Proposée** — à valider par les mainteneurs (CODEOWNERS) |
| Périmètre | Lots 0 à 3 |
| Références | §4, §5, §7, §8 des spécifications ; règles immuables citées ci-dessous |

## Contexte

Le MVP 0.4.0 livre un produit utilisable de bout en bout (connexion, projets, éléments, workflows, backlog, board, recherche). Certaines briques prévues aux lots 0 à 3 sont simplifiées ou reportées. Aucun écart n'enfreint une règle immuable sans être signalé ici.

## Écarts d'architecture

| # | Prévu | Réalisé dans le MVP | Justification | Suite |
|---|---|---|---|---|
| E1 | `policy` en Rust avec Cedar, évaluation WASM locale (L1-03 à L1-05) | Moteur de décision TypeScript (`services/policy`) évaluant une **projection locale** des attributions alimentée par les événements d'identity : RBAC, refus explicites prioritaires, R3 réservé à l'interface avec MFA récente, clé en lecture seule | RI-ARC-13 : Rust n'est introduit que par ADR sur besoin mesuré ; la projection locale respecte RI-SRV-03 (aucun saut synchrone) | Stories L1-03 à L1-05 conservées |
| E2 | Kysely comme constructeur de requêtes | Pilote `pg` avec SQL **exclusivement paramétré** | Moins de dépendances ; RI-COD-09 respectée | À réévaluer |
| E3 | Unités `pv-edge`, `pv-core`, `pv-read`, `pv-async` | Une seule unité `pv-app` regroupant tous les services | RI-SRV-09 : le regroupement est une configuration ; les services ne s'importent pas entre eux | Scission selon la charge |
| E4 | pg-boss, `LISTEN/NOTIFY`, `realtime` (WebSocket) | Relais d'outbox en processus, réveillé après chaque transaction et toutes les secondes ; l'interface relit l'état serveur | Simplicité du MVP | L3-31 (temps réel) |
| E5 | Mot de passe, OIDC, WebAuthn, OAuth 2.1 | Comptes locaux argon2id, sessions, TOTP + codes de récupération, clé API personnelle | Priorité au parcours utilisable | L1-19 à L1-22 |
| E6 | Journal d'audit ancré | Chaîne SHA-256 par organisation, vérifiable (`/audit/verification`) ; actions hors organisation (connexion, initialisation) dans une chaîne d'instance | Ancrage externe reporté | L1-12 |
| E7 | Images publiées sur GHCR et signées | Construction sur le VPS par Coolify | Voir ADR-0004 | L0-34 |
| E8 | CSP `style-src 'self'` stricte | Ajout de `style-src-attr 'unsafe-inline'` et de deux empreintes de `<style>` pour le DSFR | Le script du DSFR positionne des attributs de style | Voir ADR-0005 |

## Fonctionnalités reportées

Portefeuilles, trains et produits (L2-14), politique de clés par projet (L2-15), comptes de service et jetons courts (L1-16, L1-17), politiques d'organisation (L1-23), migration d'éléments entre versions de workflow (L3-04), champs personnalisés (L3-13), mentions (L3-14), relations (L3-15), opérations en masse (L3-19), déplacement entre projets (L3-20), éditeur de hiérarchie (L3-22), site VitePress (L0-35), superviseur portable (L0-32), crate `pv-ops` (L0-25).

## Dette connue au moment de la PR

- Seuils RI-COD-03 : certaines fonctions dépassent 30 lignes ou 3 paramètres (cas d'usage recevant dépendances, contexte, projet et entrée) ; le lint bloquant les signale. Refactorisation suivie dans une story dédiée.
- Tests : décision d'autorisation et tests de fumée de bout en bout ; tests de propriétés, de contrat des ports, de mutation et Gherkin exécutés à compléter (RI-TST-01 à RI-TST-07).

## Conséquences

Cette ADR doit être acceptée par les mainteneurs avant la fusion des PR du MVP.
