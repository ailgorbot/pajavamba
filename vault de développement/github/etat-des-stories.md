---
type: généré
mise_a_jour: 2026-10-02
source: projet GitHub n° 2 (gh project item-list)
---

# État des stories (page générée)

Générée par `outils/instantane-github.mjs`. Synthèse et interprétation : [[etat-du-projet]] et pages de [[index|lots]].

| Lot | Done | In progress | Backlog |
|---|---|---|---|
| Hors lot | 29 | 0 | 1 |
| Lot 00 — Socle | 32 | 6 | 8 |
| Lot 01 — Identité et accès | 15 | 3 | 9 |
| Lot 02 — Projets et équipes | 16 | 1 | 3 |
| Lot 03 — Éléments et workflows | 21 | 3 | 9 |
| Lot 04 — Planification | 0 | 0 | 16 |
| Lot 05 — Intégration | 0 | 0 | 21 |
| Lot 06 — OpenFox | 0 | 0 | 13 |
| Lot 07 — Livraison | 0 | 0 | 15 |
| Lot 08 — Dépendances, risques et PVQL | 0 | 0 | 9 |
| Lot 09 — SAFe et pilotage | 0 | 0 | 16 |
| Lot 10 — Automatisations, intégrations et extensions | 0 | 0 | 11 |
| Lot 11 — Identité avancée | 0 | 0 | 7 |
| Lot 12 — Imports, exports et recherche sémantique | 0 | 0 | 7 |
| Lot 13 — Portefeuille avancé | 0 | 0 | 6 |
| Lot 14 — Extensions WASM | 0 | 0 | 6 |
| Lot 15 — PWA, anglais, base dédiée, broker | 0 | 0 | 5 |

## Hors lot

| Issue | Story | Statut |
|---|---|---|
| [#248](https://github.com/ailgorbot/pajavamba/issues/248) | feat(identity): lot 1 — identité et accès (MVP 0.4.0) | Done |
| [#249](https://github.com/ailgorbot/pajavamba/issues/249) | feat(socle): lot 0 — socle du MVP 0.4.0 | Done |
| [#250](https://github.com/ailgorbot/pajavamba/issues/250) | Feat/l2 projets | Done |
| [#251](https://github.com/ailgorbot/pajavamba/issues/251) | Feat/l3 elements | Done |
| [#252](https://github.com/ailgorbot/pajavamba/issues/252) | feat(portfolio): lot 2 — projets et équipes (MVP 0.4.0) | Done |
| [#253](https://github.com/ailgorbot/pajavamba/issues/253) | feat(workitem): lot 3 — éléments, workflows, backlog et board (MVP 0.4.0) | Done |
| [#254](https://github.com/ailgorbot/pajavamba/issues/254) | [L0-36] Mettre le code du MVP aux seuils RI-COD-03 et rendre le lint vert | Done |
| [#255](https://github.com/ailgorbot/pajavamba/issues/255) | fix(socle): rétablir les outils de fumée après la fusion du lot 3 | Done |
| [#256](https://github.com/ailgorbot/pajavamba/issues/256) | docs(gouvernance): publier les fichiers de gouvernance du dépôt | Done |
| [#257](https://github.com/ailgorbot/pajavamba/issues/257) | ci(contribution): modèles de PR et de tickets, contrôle du modèle de PR | Done |
| [#259](https://github.com/ailgorbot/pajavamba/issues/259) | docs(socle): règle RI-DOC-10 et ADR-0007 — vault de développement des agents | Done |
| [#260](https://github.com/ailgorbot/pajavamba/issues/260) | docs(socle): amorcer le vault de développement (schéma, index, lots, GitHub) | Done |
| [#261](https://github.com/ailgorbot/pajavamba/issues/261) | docs(socle): compléter le vault (modules, concepts, décisions, exploitation, leçons) | Done |
| [#262](https://github.com/ailgorbot/pajavamba/issues/262) | docs(socle): règle RI-DOC-10 et ADR-0007 — vault de développement des… | Done |
| [#263](https://github.com/ailgorbot/pajavamba/issues/263) | ci(socle): détecter les secrets, vérifier l'orthographe et le Markdown | Done |
| [#264](https://github.com/ailgorbot/pajavamba/issues/264) | ci(socle): SAST Semgrep et audit des dépendances bloquants | Done |
| [#268](https://github.com/ailgorbot/pajavamba/issues/268) | fix(socle): imposer une étiquette AES-GCM de 16 octets au déchiffrement | Done |
| [#269](https://github.com/ailgorbot/pajavamba/issues/269) | build(socle): durcir la chaîne d'approvisionnement pnpm et npm | Done |
| [#270](https://github.com/ailgorbot/pajavamba/issues/270) | ci(socle): traiter le faux positif et les erreurs d'analyse de l'audit Semgrep | Done |
| [#272](https://github.com/ailgorbot/pajavamba/issues/272) | docs(socle): règle RI-SEC-14 — audit Semgrep à chaque livraison | Done |
| [#274](https://github.com/ailgorbot/pajavamba/issues/274) | ci(socle): jeux de règles Semgrep officiels chaque lundi en CI | Done |
| [#275](https://github.com/ailgorbot/pajavamba/issues/275) | ci(socle): couches (dependency-cruiser), sentinelles et Prettier progressif | Done |
| [#276](https://github.com/ailgorbot/pajavamba/issues/276) | [Semgrep] Injection de github.base_ref dans une commande run (PR #275) | Done |
| [#281](https://github.com/ailgorbot/pajavamba/issues/281) | fix(docs): rétablir l'espacement du journal du vault après la fusion de #275 | Done |
| [#282](https://github.com/ailgorbot/pajavamba/issues/282) | ci(socle): audit DAST OWASP ZAP à chaque livraison (RI-SEC-15) | Done |
| [#283](https://github.com/ailgorbot/pajavamba/issues/283) | docs(socle): vault — audit DAST OWASP ZAP (L0-39) | Done |
| [#284](https://github.com/ailgorbot/pajavamba/issues/284) | fix(socle): retirer le rapport ZAP de la recette commité par erreur | Done |
| [#286](https://github.com/ailgorbot/pajavamba/issues/286) | ci(socle): justifier l'alerte ZAP 10015 relevée sur la recette | Done |
| [#287](https://github.com/ailgorbot/pajavamba/issues/287) | ci(socle): vérifier les titres de PR et préparer release-please | Done |
| [#288](https://github.com/ailgorbot/pajavamba/issues/288) | fix(docs): rendre le journal du vault robuste aux fusions parallèles | Backlog |

## Lot 00 — Socle

| Issue | Story | Statut |
|---|---|---|
| [#3](https://github.com/ailgorbot/pajavamba/issues/3) | [L0-03] ADR-0001 : licence du cœur | Done |
| [#4](https://github.com/ailgorbot/pajavamba/issues/4) | [L0-04] ADR-0002 : versions figées de Node.js, PostgreSQL et Rust | Done |
| [#5](https://github.com/ailgorbot/pajavamba/issues/5) | [L0-05] ADR-0003 : portées de commit et conventions Git | Done |
| [#6](https://github.com/ailgorbot/pajavamba/issues/6) | [L0-06] ADR-0004 : livraison de la recette sur Coolify | Done |
| [#7](https://github.com/ailgorbot/pajavamba/issues/7) | [L0-07] ADR-0005 : thème du déploiement de recette | Done |
| [#8](https://github.com/ailgorbot/pajavamba/issues/8) | [L0-08] Publier les fichiers de gouvernance du dépôt | Done |
| [#9](https://github.com/ailgorbot/pajavamba/issues/9) | [L0-09] Créer les modèles de PR, de tickets et les étiquettes | Done |
| [#11](https://github.com/ailgorbot/pajavamba/issues/11) | [L0-11] Outiller le monorepo TypeScript (pnpm, Nx, tsconfig strict) | Done |
| [#13](https://github.com/ailgorbot/pajavamba/issues/13) | [L0-13] Configurer ESLint, Prettier, dependency-cruiser et les seuils de code | Done |
| [#14](https://github.com/ailgorbot/pajavamba/issues/14) | [L0-14] Installer gitleaks, cspell et markdownlint | Done |
| [#15](https://github.com/ailgorbot/pajavamba/issues/15) | [L0-15] Mettre en place la CI minimale (ci.yml) | Done |
| [#16](https://github.com/ailgorbot/pajavamba/issues/16) | [L0-16] Ajouter le workflow de sécurité (security.yml) | Done |
| [#17](https://github.com/ailgorbot/pajavamba/issues/17) | [L0-17] Contrôler les Conventional Commits et automatiser les versions (release-please) | Done |
| [#19](https://github.com/ailgorbot/pajavamba/issues/19) | [L0-19] Créer packages/kernel (identifiants typés, Result, ExecutionContext) | Done |
| [#20](https://github.com/ailgorbot/pajavamba/issues/20) | [L0-20] OPS : configuration validée au démarrage | Done |
| [#21](https://github.com/ailgorbot/pajavamba/issues/21) | [L0-21] OPS : journal structuré catalogué, masquage et valeurs sentinelles | Done |
| [#22](https://github.com/ailgorbot/pajavamba/issues/22) | [L0-22] OPS : serveur HTTP, sondes de santé, corrélation et erreurs RFC 9457 | Done |
| [#24](https://github.com/ailgorbot/pajavamba/issues/24) | [L0-24] OPS : migrateur SQL versionné | Done |
| [#26](https://github.com/ailgorbot/pajavamba/issues/26) | [L0-26] Créer packages/contracts et le registre d'actions | Done |
| [#28](https://github.com/ailgorbot/pajavamba/issues/28) | [L0-28] Gabarit de service : couche fonctionnelle du service exemple | Done |
| [#29](https://github.com/ailgorbot/pajavamba/issues/29) | [L0-29] Gabarit de service : couche structure sur PostgreSQL réel | Done |
| [#30](https://github.com/ailgorbot/pajavamba/issues/30) | [L0-30] Créer packages/ui : façade DSFR et coque applicative | Done |
| [#31](https://github.com/ailgorbot/pajavamba/issues/31) | [L0-31] Créer apps/web minimale avec icônes et contrôles d'accessibilité | Done |
| [#33](https://github.com/ailgorbot/pajavamba/issues/33) | [L0-33] Fournir deploy/compose et des images OCI minimales | Done |
| [#258](https://github.com/ailgorbot/pajavamba/issues/258) | [L0-37] Tenir un vault de développement (LLM Wiki) comme mémoire des agents | Done |
| [#267](https://github.com/ailgorbot/pajavamba/issues/267) | [Semgrep] Traiter les faux positifs et erreurs d'analyse de l'audit | Done |
| [#271](https://github.com/ailgorbot/pajavamba/issues/271) | [L0-38] Auditer le code avec Semgrep à chaque livraison et traiter chaque constat | Done |
| [#273](https://github.com/ailgorbot/pajavamba/issues/273) | [Semgrep] Exécuter les jeux de règles officiels en CI planifiée | Done |
| [#277](https://github.com/ailgorbot/pajavamba/issues/277) | [L0-39] Auditer l'application avec OWASP ZAP (DAST) à chaque livraison | Done |
| [#278](https://github.com/ailgorbot/pajavamba/issues/278) | [ZAP] Ajouter l'en-tête Cross-Origin-Embedder-Policy | Done |
| [#279](https://github.com/ailgorbot/pajavamba/issues/279) | [ZAP] Mettre en cache les ressources versionnées de l'interface | Done |
| [#285](https://github.com/ailgorbot/pajavamba/issues/285) | [ZAP] Justifier l'alerte 10015 (directives de cache) relevée sur la recette | Done |
| [#18](https://github.com/ailgorbot/pajavamba/issues/18) | [L0-18] Créer les squelettes docs.yml et release.yml | In progress |
| [#23](https://github.com/ailgorbot/pajavamba/issues/23) | [L0-23] OPS : client HTTP résilient, pool PostgreSQL, idempotence et limitation de débit | In progress |
| [#27](https://github.com/ailgorbot/pajavamba/issues/27) | [L0-27] Générer la référence, le registre des règles et la traçabilité (tools/) | In progress |
| [#34](https://github.com/ailgorbot/pajavamba/issues/34) | [L0-34] Déployer automatiquement la recette sur Coolify et poser v0.1.0 | In progress |
| [#265](https://github.com/ailgorbot/pajavamba/issues/265) | [Semgrep] Imposer la longueur de l'étiquette AES-GCM au déchiffrement des champs | In progress |
| [#266](https://github.com/ailgorbot/pajavamba/issues/266) | [Semgrep] Durcir la chaîne d'approvisionnement pnpm et npm | In progress |
| [#1](https://github.com/ailgorbot/pajavamba/issues/1) | [L0-01] Protéger la branche main par des rulesets | Backlog |
| [#2](https://github.com/ailgorbot/pajavamba/issues/2) | [L0-02] Activer la sécurité du dépôt GitHub | Backlog |
| [#10](https://github.com/ailgorbot/pajavamba/issues/10) | [L0-10] Créer la GitHub App des agents de développement | Backlog |
| [#12](https://github.com/ailgorbot/pajavamba/issues/12) | [L0-12] Outiller le workspace Rust (Cargo, clippy, rustfmt, cargo-deny) | Backlog |
| [#25](https://github.com/ailgorbot/pajavamba/issues/25) | [L0-25] Créer crates/pv-ops (équivalent Rust de OPS) | Backlog |
| [#32](https://github.com/ailgorbot/pajavamba/issues/32) | [L0-32] Créer le squelette de la commande pajavamba (pv-supervisor) | Backlog |
| [#35](https://github.com/ailgorbot/pajavamba/issues/35) | [L0-35] Publier le site de documentation VitePress | Backlog |
| [#280](https://github.com/ailgorbot/pajavamba/issues/280) | [ZAP] Étendre l'audit DAST aux parcours authentifiés et à l'API | Backlog |

## Lot 01 — Identité et accès

| Issue | Story | Statut |
|---|---|---|
| [#36](https://github.com/ailgorbot/pajavamba/issues/36) | [L1-01] Modéliser les organisations et les appartenances | Done |
| [#37](https://github.com/ailgorbot/pajavamba/issues/37) | [L1-02] Modéliser les rôles, attributions par portée et refus explicites | Done |
| [#41](https://github.com/ailgorbot/pajavamba/issues/41) | [L1-06] Initialiser l'instance et créer le propriétaire avec un compte local | Done |
| [#42](https://github.com/ailgorbot/pajavamba/issues/42) | [L1-07] Se connecter avec un compte local et ouvrir une session | Done |
| [#43](https://github.com/ailgorbot/pajavamba/issues/43) | [L1-08] Consulter et révoquer mes sessions, me déconnecter | Done |
| [#44](https://github.com/ailgorbot/pajavamba/issues/44) | [L1-09] Inviter, désactiver et réactiver des utilisateurs | Done |
| [#46](https://github.com/ailgorbot/pajavamba/issues/46) | [L1-11] Relayer les événements des outbox (event-relay) | Done |
| [#47](https://github.com/ailgorbot/pajavamba/issues/47) | [L1-12] Tenir le journal d'audit chaîné et vérifiable | Done |
| [#48](https://github.com/ailgorbot/pajavamba/issues/48) | [L1-13] Vérifier chaque requête dans l'api-gateway | Done |
| [#49](https://github.com/ailgorbot/pajavamba/issues/49) | [L1-14] Créer, régénérer et révoquer ma clé API personnelle | Done |
| [#50](https://github.com/ailgorbot/pajavamba/issues/50) | [L1-15] Appeler l'API avec une clé et un projet, droits recalculés à chaque appel | Done |
| [#53](https://github.com/ailgorbot/pajavamba/issues/53) | [L1-18] Activer la MFA par TOTP avec codes de récupération | Done |
| [#59](https://github.com/ailgorbot/pajavamba/issues/59) | [L1-24] Afficher les écrans de connexion et d'erreur | Done |
| [#60](https://github.com/ailgorbot/pajavamba/issues/60) | [L1-25] Gérer mon profil, ma clé API, mes sessions et ma MFA dans l'interface | Done |
| [#61](https://github.com/ailgorbot/pajavamba/issues/61) | [L1-26] Consulter le journal d'audit (auditeur) | Done |
| [#45](https://github.com/ailgorbot/pajavamba/issues/45) | [L1-10] Gérer les groupes et attribuer ou retirer des rôles | In progress |
| [#54](https://github.com/ailgorbot/pajavamba/issues/54) | [L1-19] Activer WebAuthn et appliquer la politique MFA et la MFA récente | In progress |
| [#62](https://github.com/ailgorbot/pajavamba/issues/62) | [L1-27] Documenter le lot 1 (prise en main, authentification API, fiches DAD) | In progress |
| [#38](https://github.com/ailgorbot/pajavamba/issues/38) | [L1-03] Définir le domaine de décision d'autorisation (pv-policy-domain) | Backlog |
| [#39](https://github.com/ailgorbot/pajavamba/issues/39) | [L1-04] Évaluer les politiques Cedar dans le service policy | Backlog |
| [#40](https://github.com/ailgorbot/pajavamba/issues/40) | [L1-05] Évaluer les politiques localement en WASM avec cache invalidé par événements | Backlog |
| [#51](https://github.com/ailgorbot/pajavamba/issues/51) | [L1-16] Émettre un jeton court de projet | Backlog |
| [#52](https://github.com/ailgorbot/pajavamba/issues/52) | [L1-17] Gérer les comptes de service d'un projet | Backlog |
| [#55](https://github.com/ailgorbot/pajavamba/issues/55) | [L1-20] Fournir le serveur d'autorisation OAuth 2.1 | Backlog |
| [#56](https://github.com/ailgorbot/pajavamba/issues/56) | [L1-21] Se connecter par SSO OpenID Connect | Backlog |
| [#57](https://github.com/ailgorbot/pajavamba/issues/57) | [L1-22] Disposer d'un compte de secours par organisation | Backlog |
| [#58](https://github.com/ailgorbot/pajavamba/issues/58) | [L1-23] Configurer les politiques d'organisation | Backlog |

## Lot 02 — Projets et équipes

| Issue | Story | Statut |
|---|---|---|
| [#63](https://github.com/ailgorbot/pajavamba/issues/63) | [L2-01] Modéliser le cycle de vie d'un projet | Done |
| [#64](https://github.com/ailgorbot/pajavamba/issues/64) | [L2-02] Persister le service portfolio | Done |
| [#65](https://github.com/ailgorbot/pajavamba/issues/65) | [L2-03] Créer un projet en brouillon | Done |
| [#66](https://github.com/ailgorbot/pajavamba/issues/66) | [L2-04] Modifier les informations d'un projet | Done |
| [#67](https://github.com/ailgorbot/pajavamba/issues/67) | [L2-05] Activer un projet | Done |
| [#68](https://github.com/ailgorbot/pajavamba/issues/68) | [L2-06] Créer et modifier des équipes | Done |
| [#69](https://github.com/ailgorbot/pajavamba/issues/69) | [L2-07] Gérer les membres d'une équipe et rattacher les équipes à un projet | Done |
| [#70](https://github.com/ailgorbot/pajavamba/issues/70) | [L2-08] Gérer les membres et les rôles d'un projet | Done |
| [#71](https://github.com/ailgorbot/pajavamba/issues/71) | [L2-09] Clôturer un projet avec l'assistant de clôture | Done |
| [#72](https://github.com/ailgorbot/pajavamba/issues/72) | [L2-10] Rouvrir un projet clôturé | Done |
| [#73](https://github.com/ailgorbot/pajavamba/issues/73) | [L2-11] Archiver et désarchiver un projet | Done |
| [#74](https://github.com/ailgorbot/pajavamba/issues/74) | [L2-12] Programmer, annuler la suppression d'un projet | Done |
| [#75](https://github.com/ailgorbot/pajavamba/issues/75) | [L2-13] Purger un projet à l'échéance | Done |
| [#78](https://github.com/ailgorbot/pajavamba/issues/78) | [L2-16] Afficher la liste des projets | Done |
| [#79](https://github.com/ailgorbot/pajavamba/issues/79) | [L2-17] Créer un projet et l'administrer depuis l'interface | Done |
| [#80](https://github.com/ailgorbot/pajavamba/issues/80) | [L2-18] Clôturer, archiver et supprimer depuis l'interface | Done |
| [#82](https://github.com/ailgorbot/pajavamba/issues/82) | [L2-20] Documenter le lot 2 (premier projet, clôture, archivage) | In progress |
| [#76](https://github.com/ailgorbot/pajavamba/issues/76) | [L2-14] Gérer portefeuilles, flux de valeur, trains et produits | Backlog |
| [#77](https://github.com/ailgorbot/pajavamba/issues/77) | [L2-15] Appliquer la politique de clés API par projet et la sensibilité | Backlog |
| [#81](https://github.com/ailgorbot/pajavamba/issues/81) | [L2-19] Tester la montée de version et le retour arrière en recette | Backlog |

## Lot 03 — Éléments et workflows

| Issue | Story | Statut |
|---|---|---|
| [#83](https://github.com/ailgorbot/pajavamba/issues/83) | [L3-01] Modéliser les workflows versionnés, états et catégories | Done |
| [#84](https://github.com/ailgorbot/pajavamba/issues/84) | [L3-02] Évaluer les transitions et leurs conditions déclaratives | Done |
| [#85](https://github.com/ailgorbot/pajavamba/issues/85) | [L3-03] Créer et publier un workflow par l'API | Done |
| [#87](https://github.com/ailgorbot/pajavamba/issues/87) | [L3-05] Fournir les packs méthodologiques Scrum et Kanban | Done |
| [#88](https://github.com/ailgorbot/pajavamba/issues/88) | [L3-06] Fournir les packs Scrumban et Personnalisé | Done |
| [#89](https://github.com/ailgorbot/pajavamba/issues/89) | [L3-07] Exiger un workflow publié pour chaque type à l'activation | Done |
| [#90](https://github.com/ailgorbot/pajavamba/issues/90) | [L3-08] Modéliser les types d'éléments et la hiérarchie configurable | Done |
| [#91](https://github.com/ailgorbot/pajavamba/issues/91) | [L3-09] Créer un élément de travail | Done |
| [#92](https://github.com/ailgorbot/pajavamba/issues/92) | [L3-10] Modifier un élément de travail | Done |
| [#93](https://github.com/ailgorbot/pajavamba/issues/93) | [L3-11] Faire passer un élément dans un nouvel état | Done |
| [#98](https://github.com/ailgorbot/pajavamba/issues/98) | [L3-16] Ordonner et estimer le backlog | Done |
| [#99](https://github.com/ailgorbot/pajavamba/issues/99) | [L3-17] Protéger les éléments confidentiels | Done |
| [#100](https://github.com/ailgorbot/pajavamba/issues/100) | [L3-18] Supprimer un élément dans la corbeille et le restaurer | Done |
| [#103](https://github.com/ailgorbot/pajavamba/issues/103) | [L3-21] Consulter l'historique d'un élément | Done |
| [#105](https://github.com/ailgorbot/pajavamba/issues/105) | [L3-23] Projeter les vues de lecture dans query | Done |
| [#106](https://github.com/ailgorbot/pajavamba/issues/106) | [L3-24] Rechercher en plein texte français | Done |
| [#107](https://github.com/ailgorbot/pajavamba/issues/107) | [L3-25] Consulter le journal d'activité | Done |
| [#108](https://github.com/ailgorbot/pajavamba/issues/108) | [L3-26] Afficher et manipuler le backlog | Done |
| [#109](https://github.com/ailgorbot/pajavamba/issues/109) | [L3-27] Afficher le board et déplacer les cartes au clavier | Done |
| [#110](https://github.com/ailgorbot/pajavamba/issues/110) | [L3-28] Afficher le détail d'un élément | Done |
| [#112](https://github.com/ailgorbot/pajavamba/issues/112) | [L3-30] Rechercher et consulter l'activité dans l'interface | Done |
| [#94](https://github.com/ailgorbot/pajavamba/issues/94) | [L3-12] Assigner un élément, gérer observateurs et étiquettes | In progress |
| [#96](https://github.com/ailgorbot/pajavamba/issues/96) | [L3-14] Commenter un élément et mentionner des personnes | In progress |
| [#115](https://github.com/ailgorbot/pajavamba/issues/115) | [L3-33] Documenter le lot 3 (éléments, workflows, backlog, board) | In progress |
| [#86](https://github.com/ailgorbot/pajavamba/issues/86) | [L3-04] Migrer des éléments vers une nouvelle version de workflow | Backlog |
| [#95](https://github.com/ailgorbot/pajavamba/issues/95) | [L3-13] Définir des champs personnalisés classés | Backlog |
| [#97](https://github.com/ailgorbot/pajavamba/issues/97) | [L3-15] Relier des éléments et référencer la connaissance | Backlog |
| [#101](https://github.com/ailgorbot/pajavamba/issues/101) | [L3-19] Appliquer des opérations en masse | Backlog |
| [#102](https://github.com/ailgorbot/pajavamba/issues/102) | [L3-20] Déplacer un élément vers un autre projet | Backlog |
| [#104](https://github.com/ailgorbot/pajavamba/issues/104) | [L3-22] Configurer les types d'éléments et la hiérarchie d'un projet | Backlog |
| [#111](https://github.com/ailgorbot/pajavamba/issues/111) | [L3-29] Éditer un workflow dans l'interface | Backlog |
| [#113](https://github.com/ailgorbot/pajavamba/issues/113) | [L3-31] Diffuser des signaux temps réel (realtime) | Backlog |
| [#114](https://github.com/ailgorbot/pajavamba/issues/114) | [L3-32] Raccourcis clavier, palette de commandes et densité d'affichage | Backlog |
