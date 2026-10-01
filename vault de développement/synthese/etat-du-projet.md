---
type: synthèse
mise_a_jour: 2026-10-01
sources: [CHANGELOG.md, docs/adr/, projet GitHub n° 2, historique Git de main]
---

# État du projet

## En une phrase

Le **MVP 0.4.0** (lots 0 à 3) est fusionné sur `main`, déployé en recette sur Coolify et validé par le mainteneur ; on complète maintenant, story par story, ce qui a été simplifié ou reporté dans les lots 0 à 3 avant d'attaquer le lot 4 (planification).

## Ce qui existe

- Produit utilisable de bout en bout : initialisation, connexion (TOTP), rôles, projets (cycle de vie complet), équipes, workflows Scrum/Kanban/Scrumban/Personnalisé, éléments et hiérarchie, backlog, board accessible au clavier, recherche plein texte, journal d'activité, audit chaîné. Détails : [[lot-00-socle]], [[lot-01-identite-acces]], [[lot-02-projets-equipes]], [[lot-03-elements-workflows]].
- 9 services TypeScript dans une seule unité `pv-app` (voir [[pv-app-et-compose]]), 56 actions d'API générées depuis le registre (voir [[chaine-d-ecriture]]).
- CI verte : types, tests unitaires, référence synchronisée, lint aux seuils, construction de l'interface, pile conteneurisée + tests de fumée, présence des fichiers de gouvernance, modèle de PR complet. Voir [[processus-github]].
- Écarts assumés du MVP consignés dans ADR-0006 (**proposée, à valider par le mainteneur**). Voir [[registre-des-adr]].

## En cours (01/10/2026)

| Sujet | État |
|---|---|
| Vault de développement ([#258](https://github.com/ailgorbot/pajavamba/issues/258)) | Livré (#259 à #262) ; tenu à jour dans chaque PR de story |
| L0-14 ([#14](https://github.com/ailgorbot/pajavamba/issues/14)) | Livré (#263) : gitleaks, cspell, markdownlint |
| L0-16 ([#16](https://github.com/ailgorbot/pajavamba/issues/16)) | Branche `ci/16-securite` : `security.yml` (Semgrep en conteneur, règles `.semgrep/`, audit pnpm) |
| Stories partielles du lot 0 | L0-13 (Prettier, dependency-cruiser), L0-23 (client HTTP résilient, limitation de débit), L0-27 (registre des règles, traçabilité), L0-34 (livraison automatique, tag v0.1.0) |
| Stories partielles des lots 1 à 3 | L1-10 (groupes), L1-19 (WebAuthn, politique MFA), L3-12 (observateurs, étiquettes), L3-14 (mentions), documentation des lots (L1-27, L2-20, L3-33) |

Statuts à jour : [[etat-des-stories]].

## Prochaines étapes proposées

1. Après L0-16, reprise des stories du lot 0 dans l'ordre : L0-13, L0-17 (release-please), L0-01/L0-02 (rulesets, sécurité du dépôt : actions du mainteneur dans GitHub).
2. Validation d'ADR-0006 par le mainteneur.
3. Compléter les stories partielles des lots 1 à 3, puis lot 4 ([[lots-04-a-15]]).

## Points d'attention

- Une PR = une story, ≤ 400 lignes ; un agent ne fusionne jamais : le mainteneur fusionne.
- Le poste de développement a des contournements (disque D:) : [[poste-de-developpement]].
- Leçons à ne pas répéter : [[lecons-apprises]].
