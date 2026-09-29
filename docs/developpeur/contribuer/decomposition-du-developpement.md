---
titre: Décomposition et ordonnancement du développement
public: développeurs, mainteneurs
statut: brouillon
version_min: 0.1.0
mise_a_jour: 2026-09-29
---

# PajaVamba — Décomposition et ordonnancement du développement

| Élément | Valeur |
|---|---|
| Version du document | 0.1.0 (proposition) |
| Date | 29/09/2026 |
| Documents associés | `PajaVamba_Specifications_Techniques.md` (§), `PajaVamba_Regles_Immuables.md` (RI-…) |
| Emplacement cible dans le dépôt | `docs/developpeur/contribuer/decomposition-du-developpement.md` |
| Autorité | Les règles immuables prévalent sur ce plan ; aucun lot ne déroge à une règle. |

## 1. Principes d'ordonnancement

1. **Le sens des dépendances fixe l'ordre** : `kernel` et OPS (feuilles) → `fonctionnel` (couche basse) → `structure` (couche moyenne) → passerelles → interface → empaquetage. OPS est la couche « haute », mais elle ne dépend d'aucun code du projet (RI-ARC-04) et la couche moyenne l'importe (§5.3.2) : elle est donc construite **avant** `structure`. C'est la seule entorse à l'ordre « basse → haute ».
2. **Primordial avant optionnel** : une brique est primordiale si aucune autre ne fonctionne sans elle. La chaîne OpenFox est optionnelle, car PajaVamba fonctionne intégralement sans OpenFox (RI-OFX-18).
3. **Un lot = un incrément livrable** : versionné (SemVer), déployé sur le VPS, documenté, tagué dans Git.
4. **Une story = une PR ≤ 400 lignes** (RI-REV-02), tranche verticale d'un service construite du bas vers le haut (§5 ci-dessous).
5. **Aucune fusion hors CI verte**, sans exception d'urgence (RI-REV-04, RI-REV-08).
6. **Dépendances et dossiers introduits au lot qui en a besoin** : rien d'anticipé (RI-COD-10, RI-COD-11).

## 2. Étape 0 — Préparation

### 2.1 Répertoire projet

```bash
mkdir pajavamba && cd pajavamba
mkdir -p apps/web services crates packages/{ops,kernel,contracts,ui,sdk-ts} \
  tools deploy/{portable,compose} .github \
  docs/{fonctionnel,installation,exploitation,reference,adr} \
  docs/developpeur/{api,mcp,plugins,contribuer} \
  docs/specifications/{fonctionnelles,technique} \
  docs/architecture/{dag,dad}
```

- Arborescence conforme au §5.2 et au §21.2. Git ne versionne pas les dossiers vides : ils apparaissent avec leur premier fichier.
- Créés plus tard, à leur lot : `deploy/helm` (lot 12), `packages/plugin-cli` (lot 10), `crates/pv-plugin-host` (lot 14).
- Documents d'entrée placés dès le départ :
  - `docs/regles-immuables.md` (emplacement imposé par le document lui-même) ;
  - `docs/specifications/technique/specifications-techniques.md`.

### 2.2 Composants à récupérer

Versions exactes figées par ADR (H11) puis par fichiers de verrouillage. Installation toujours figée : `pnpm install --frozen-lockfile`, `cargo … --locked` (RI-COD-10). Chaque dépendance est justifiée (usage, maintenance, licence, sécurité) avant son ajout. Python est exclu du produit ; Semgrep et Schemathesis s'exécutent en conteneur (H10).

| Catégorie | Composants | Lot |
|---|---|---|
| Poste et outils | Git, GitHub CLI, Node.js LTS active, pnpm, Nx, rustup (`rust-toolchain.toml`, édition 2024), Podman ou Docker, PostgreSQL (image officielle via Testcontainers ; extensions `ltree`, `pg_trgm`, `citext`, `unaccent`) | 0 |
| Qualité TypeScript | ESLint (`typescript-eslint` strict-type-checked, jsdoc, sonarjs), Prettier, dependency-cruiser, Vitest, fast-check, Stryker | 0 |
| Qualité Rust | clippy (`-D warnings`, pedantic), rustfmt, cargo-deny, cargo-audit, proptest, cargo-mutants | 0 |
| Sécurité du dépôt | gitleaks, Semgrep (conteneur), CodeQL, Dependabot | 0 |
| Documentation | VitePress, TypeDoc, `cargo doc`, tbls, Mermaid, markdownlint, cspell, lychee, Spectral | 0 |
| Socle TypeScript | Fastify + fournisseur de types Zod, Zod, Kysely + `pg`, pino, OpenTelemetry | 0 |
| Socle Rust | tokio, axum, tower, reqwest, sqlx, serde, thiserror, tracing, opentelemetry | 0–1 |
| Identité et droits | argon2, `oidc-provider`, `@simplewebauthn/server`, bibliothèque TOTP (ADR), Cedar (`cedar-policy` + build WASM) | 1 |
| Asynchrone | pg-boss | 1 |
| Interface | React, Vite, TanStack Router et Query, React Aria, `@gouvfr/dsfr`, `@codegouvfr/react-dsfr`, FormatJS, Playwright, axe-core, playwright-bdd | 0–2 |
| Tests non fonctionnels | k6, Schemathesis (conteneur), Pact | 3–5 |
| Ouverture | SDK TypeScript officiel du protocole MCP, générateurs de SDK | 5 |
| Livraison | release-please, cosign, SBOM CycloneDX, attestations SLSA | 0 (pipeline) / 7 (signatures de plateforme) |
| Secrets | SOPS + age ; OpenBao (topologie serveur) | 1 / 7 |
| Hébergement | VPS avec Coolify | 0 |
| Plus tard | SAML (`@node-saml/node-saml`, ADR), `wasmtime` (lot 14) | 11 / 14 |

### 2.3 Initialisation de Git

```bash
git init -b main
git config gpg.format ssh
git config user.signingkey ~/.ssh/id_ed25519.pub
git config commit.gpgsign true          # commits signés (RI-GIT-01)
printf '* text=auto eol=lf\n' > .gitattributes   # UTF-8 / LF partout (RI-RGI-01)
```

Séquence d'amorçage :

1. Ajouter `.gitignore`, `.gitattributes`, `.editorconfig` et les deux documents d'entrée ; premier commit signé : `docs(socle): ajout des spécifications et des règles immuables`.
2. Créer le dépôt GitHub **public** (C05), pousser `main`.
3. **Activer immédiatement les rulesets sur `main`** (RI-GIT-01) : PR obligatoire, approbation, CODEOWNERS, contrôles requis, historique linéaire, commits signés, aucun push forcé ni suppression ; étiquettes `v*` protégées. Ce premier push est le seul commit direct sur `main` : le dépôt est vide et les protections n'existent pas encore.
4. Activer secret scanning avec protection des pushs (motif `pvb_`), Dependabot, CodeQL, signalement privé des vulnérabilités (RI-GIT-02).
5. Par PR : fichiers de gouvernance (`README`, `LICENSE`, `SECURITY`, `CONTRIBUTING`, `CODE_OF_CONDUCT`, `GOVERNANCE`, `CODEOWNERS`) ; modèles de PR et de tickets (story, anomalie, ADR) ; étiquettes (type, service, priorité, phase) (RI-GIT-05, RI-GIT-06).
6. Créer la GitHub App des agents de développement (permissions minimales, sans droit d'approbation ni de fusion) avant toute intervention de Claude Code (RI-GIT-04, RI-REV-06).

Conventions à appliquer dès le premier commit : branches `<type>/<ticket>-<description>`, Conventional Commits (type anglais, portée, description française), fusion par squash (RI-NOM-09, RI-REV-07).

### 2.4 Décisions à acter avant le lot 0

| ADR | Sujet | Réf. |
|---|---|---|
| Licence du cœur | AGPL-3.0 ou Apache-2.0 ; `LICENSE` exigé par RI-GIT-05 | H09, C01 |
| Versions figées | Node.js, PostgreSQL, toolchain Rust | H11 |
| Portées de commit hors service | `socle`, `docs`, `ci`, `deploy` | RI-NOM-09 |
| Livraison sur Coolify | Mécanisme de déploiement, secrets, retour arrière (§7) | RI-VER-04, RI-SCR-01 |
| Thème du déploiement de recette | DSFR ou thème neutre | RI-DSF-08, C02 |

## 3. Strates : de la base vers le haut

| Strate | Contenu | Couche | Prérequis |
|---|---|---|---|
| N0 | Dépôt, outillage, CI, environnement de livraison Coolify | — | — |
| N1 | `packages/kernel`, `packages/ops`, `crates/pv-ops`, générateurs de `packages/contracts` et de `tools/`, migrateur | noyau et haute (OPS) | N0 |
| N2 | `services/<s>/fonctionnel`, crates `*-domain` | basse | N1 (kernel) |
| N3 | Migrations, schémas, rôles, RLS ; `services/<s>/structure` ; crates `*-adapters` | moyenne | N1, N2 |
| N4 | Services techniques et passerelles : `event-relay`, `audit`, `api-gateway`, `realtime`, `mcp-gateway` ; regroupement en unités de déploiement | technique | N3 |
| N5 | `packages/ui`, `apps/web`, SDK générés | présentation | contrats, API |
| N6 | `pv-supervisor`, archives portables, images OCI, compose, manuels, signatures | livraison | N4, N5 |

Les strates se parcourent à chaque lot pour les services concernés, pas une seule fois pour tout le produit.

## 4. Briques par criticité

| Criticité | Briques | Lot |
|---|---|---|
| **Primordiales** | Dépôt et CI, `kernel`, OPS (TS et Rust), registre d'actions et contrats, migrateur, `identity`, `policy`, `event-relay`, `audit`, `api-gateway`, `portfolio`, `workitem`, `workflow`, `query`, `packages/ui`, `apps/web` | 0–3 |
| **Cœur complémentaire** | `planning`, `notification`, `delivery`, rapports burndown et vélocité | 4 |
| **Ouverture** | API publique complète, webhooks, SSE, SDK, `mcp-gateway`, `approval`, `files`, import et export CSV | 5 |
| **Périphériques** | `realtime` (fin du lot 3), antivirus de `files` | 3 / 5 |
| **Optionnelles du 1.0** | Chaîne OpenFox : `openfox-adapter`, `context-gateway`, `llm-egress-proxy`, `pv-pii` | 6 |
| **Optionnelles v1** | SAFe, `dependency-risk`, PVQL, automatisations, `integration`, extensions d'interface, SAML et SCIM, imports Jira et Taiga, recherche sémantique, Helm | 8–12 |
| **Optionnelles v2** | Kanban de portefeuille, budgets, OKR, `plugin-host` WASM, catalogue public, PWA, anglais, base dédiée, broker | 13–15 |

## 5. Recette de construction d'un service (du bas vers le haut)

1. Règles de gestion `RG-…` déclarées au registre ; scénarios Gherkin en français (RI-TST-07).
2. `fonctionnel/domaine` : entités, objets valeur, événements du domaine (aucune entrée/sortie, RI-ARC-03, RI-ARC-08).
3. `fonctionnel/ports` puis `fonctionnel/cas-usage` : un cas d'usage par action, retour `{ result, events }` (RI-ARC-06) ; tests unitaires, de propriétés et de mutation.
4. `structure/migrations` : schéma, rôles, RLS, `COMMENT ON`, classes de données (RI-DON-01 à RI-DON-03).
5. `structure/persistance` : dépôts Kysely, unité de travail, outbox ; suites de contrat des ports sur l'adaptateur mémoire et PostgreSQL (RI-TST-04).
6. `structure/actions` et `structure/http` : action au registre (permission, niveau de risque), schémas Zod fermés, routes ; route, outil MCP et test d'autorisation générés.
7. `structure/evenements` et `structure/politique` : catalogue d'événements, adaptateur `AccessPolicy`.
8. `structure/composition/root.ts` : câblage manuel (RI-ARC-09).
9. Tests d'intégration sur PostgreSQL réel, Gherkin exécutés, dependency-cruiser, seuils de code.
10. Documentation de la story dans la même PR (RI-DOC-02).

Le front (`apps/web`) suit le même principe : `domaine` → `adaptateurs` → `composants` → écrans, uniquement via `packages/ui` et le client généré (RI-API-02, RI-DSF-02).

## 6. MVP et lotissement

### 6.1 Correspondance avec le §24

Le §24.1 nomme « MVP » l'ensemble des lots 0 à 7, qui mène à la version 1.0. Ce plan distingue :

- **MVP** = lots 0 à 3, version **0.4.0** : le plus petit produit utilisable de bout en bout (connexion, projets, éléments, workflows, backlog et board Kanban, recherche plein texte). Il est utilisable sans OpenFox (RI-OFX-18).
- **Produit 1.0** = périmètre « MVP » du §3.2, lots 0 à 7.
- **Phases v1 et v2** du §3.2 = versions 1.1 à 1.8 ; la 2.0.0 est réservée à un changement cassant (RI-API-06).

Écart au §24.1 : `event-relay` est ajouté au lot 1, car `audit` s'alimente par l'outbox via le relais (RI-AUD-01, §4.2).

### 6.2 Vue d'ensemble

| Lot | Version | Contenu | Résultat vérifiable | Unités ajoutées sur Coolify |
|---|---|---|---|---|
| 0 — Socle | 0.1.0 | Monorepo, CI, kernel, OPS, contrats, coque UI, gabarit de service, migrateur, catalogue de journalisation, RFC 9457, santé, configuration, squelette `pajavamba`, site de documentation, pipeline de livraison | Un service exemple passe toute la CI ; documentation publiée ; tag déployé sur Coolify | Service exemple, `pv-db` |
| 1 — Identité et accès | 0.2.0 | `identity`, `policy`, `event-relay`, `audit`, `api-gateway`, clé API, jetons courts | Connexion, attribution de rôle, appel API clé + projet, refus audités | `pv-edge`, `pv-core`, `pv-policy`, `pv-async` |
| 2 — Projets et équipes | 0.3.0 | `portfolio`, administration de projet, interface de base | Création → activation → clôture → archivage → suppression | `portfolio` (dans `pv-core`), `apps/web` |
| 3 — Éléments et workflows | **0.4.0 (MVP)** | `workitem`, `workflow`, packs Scrum et Kanban, `query`, `realtime`, backlog, board, détail | Création, hiérarchie, transitions, board accessible au clavier | `pv-read`, `realtime` (dans `pv-edge`) |
| 4 — Planification | 0.5.0 | `planning`, burndown et vélocité, `notification`, `delivery` | Cycle de sprint complet avec report explicite | — |
| 5 — Intégration | 0.6.0 | API complète, Swagger, webhooks, SSE, SDK, `mcp-gateway`, `approval`, `files`, import CSV, export | Client MCP exécutant une action R2 après validation humaine | `mcp-gateway` (dans `pv-edge`), `files` (dans `pv-async`) |
| 6 — OpenFox | 0.7.0 | `openfox-adapter`, `context-gateway`, `llm-egress-proxy`, `pv-pii`, profils, panneau assistant | Synthèse de sprint conforme au profil ; test sentinelle S bloqué | `pv-ai-guard` ; OpenFox reste séparé (§4.7) |
| 7 — Livraison | 1.0.0 (`-rc.N` d'abord) | Archives Win/Linux/macOS, images, compose, manuels, audit RGAA, test d'intrusion, homologation type | Installation sans droits administrateur sur les trois systèmes | — |
| 8 | 1.1.0 | `dependency-risk` (dépendances, risques ROAM), PVQL, filtres enregistrés | Graphe de dépendances ; requête PVQL paramétrée | — |
| 9 | 1.2.0 | SAFe (PI, PI Planning, objectifs, vote, WSJF, capacité détaillée), roadmap, métriques de flux, tableaux de bord | PI Planning complet | — |
| 10 | 1.3.0 | Automatisations, `integration` (Git, CI), extensions d'interface (iframe), `plugin-cli` | Automatisation exécutée ; extension iframe isolée | `integration` |
| 11 | 1.4.0 | SAML, SCIM, élévation temporaire, revue des accès | Provisioning SCIM ; campagne de revue | — |
| 12 | 1.5.0 | Imports Jira et Taiga, exports ODS et XLSX, recherche sémantique, Helm | Import Jira rejoué sans perte | `import` |
| 13 | 1.6.0 | Kanban de portefeuille avancé, budgets, business case, garde-fous, OKR | Flux de portefeuille de bout en bout | — |
| 14 | 1.7.0 | `plugin-host` WASM, catalogue public | Extension WASM sous quotas | `plugin-host` |
| 15 | 1.8.0 | PWA hors ligne, anglais, base dédiée par organisation, broker externe | Usage hors ligne ; interface bilingue | — |

Ordre imposé entre lots : 9 après 8 (objectifs de PI et ROAM), 12 après 6 (recherche sémantique via OpenFox), 14 après 10 (modèle d'extension).

### 6.3 Lot 0 — Socle (ordre des PR)

1. Gouvernance et modèles (§2.3).
2. Outillage du monorepo : pnpm + Nx, workspace Cargo, `tsconfig` strict complet, ESLint, Prettier, dependency-cruiser, clippy, rustfmt, cargo-deny, gitleaks, cspell, markdownlint.
3. **CI avant le code** : `ci.yml` minimal (build, lint, types, couches), puis `security.yml`, `docs.yml`, `release.yml`, contrôle des Conventional Commits, release-please.
4. `packages/kernel` : identifiants typés, `Result`, `ExecutionContext`, événements et erreurs de base.
5. `packages/ops` et `crates/pv-ops` : configuration validée, journal structuré et catalogue, `/healthz`, `/readyz`, RFC 9457, client HTTP à disjoncteur, pool, migrateur.
6. `packages/contracts` et `tools/` : registre d'actions, générateurs de la référence et de la traçabilité.
7. Gabarit de service et service exemple, de bout en bout (recette du §5) avec PostgreSQL réel.
8. `packages/ui` (coque DSFR, thèmes clair et sombre) et `apps/web` minimale, avec axe et clavier.
9. `pv-supervisor` : squelette de la commande `pajavamba`.
10. `deploy/compose` et pipeline Coolify (§7) : premier tag `v0.1.0`.
11. Site VitePress : `index`, contribution, glossaire initial, exploitation (déploiement Coolify).

Les zones `packages/ops`, `packages/kernel`, `packages/contracts`, `packages/ui`, `.github/` exigent une approbation CODEOWNERS humaine : la planifier en amont.

### 6.4 Lots 1 à 7 — ordre interne

| Lot | Ordre de construction (bas → haut) ; optionnels en dernier |
|---|---|
| 1 | `fonctionnel` d'`identity` → `pv-policy-domain` puis adaptateurs Cedar, binaire et build WASM → `structure` d'`identity` (comptes locaux, sessions, rôles, attributions) → `event-relay` → `audit` → `api-gateway` → clé API, jetons courts, comptes de service → MFA (TOTP, WebAuthn) → OIDC → écrans de connexion, profil, clé |
| 2 | `fonctionnel` de `portfolio` (cycle de vie RG-PRJ) → `structure` → équipes → administration de projet → écrans : création, assistant de clôture, archivage, suppression programmée |
| 3 | `workflow` (versions immuables) → `workitem` (types, hiérarchie, champs, relations) → packs Scrum et Kanban → `query` (vues, plein texte français, journal d'activité) → backlog, board, détail → `realtime` |
| 4 | `planning` (sprints, capacité simple, boards, WIP) → rapports → `notification` → `delivery` (email) |
| 5 | Registre complet → OpenAPI/Swagger publiés → `approval` → `mcp-gateway` → webhooks signés, SSE → `files` → SDK TS et Rust générés → import et export CSV → antivirus optionnel |
| 6 | `pv-pii` → `pv-context-domain` + profils versionnés → `context-gateway` → `llm-egress-proxy` → `openfox-adapter` → panneau assistant, prévisualisation, annulation ; test de non-régression « sans OpenFox » (RI-OFX-18) |
| 7 | `pv-supervisor` complet (`init`, `upgrade`, `rollback`, …) → archives → signatures (C03) → manuels complets → audit RGAA, test au lecteur d'écran → test d'intrusion indépendant (RI-RGS-03) → dossier d'homologation → charge (EXG-PERF) |

## 7. Déploiement sur VPS avec Coolify

### 7.1 Mise en place (lot 0)

1. Installer Coolify sur le VPS ; ouvrir uniquement 80 et 443 (plus l'accès d'administration) ; enregistrer les domaines de recette et de production (exemples : `recette.pajavamba.example.org`, `pajavamba.example.org`).
2. Créer le projet Coolify « PajaVamba » avec deux environnements : `recette` (préversions `-rc.N`) et `production` (versions stables).
3. Ressource **Docker Compose** issue de `deploy/compose/`, qui référence les **images signées de GHCR par tag figé** (jamais `latest`). Aucune construction sur le VPS : les images viennent de `release.yml` (RI-VER-02).
4. Réseau : seul `pv-edge` est exposé, via le proxy de Coolify (TLS 1.2 minimum, RI-SEC-05, RI-VER-07) ; PostgreSQL et les autres unités restent sur le réseau interne ; le proxy de Coolify est déclaré proxy de confiance pour `X-Forwarded-For` (§4.7).
5. Sondes `/readyz` sur chaque service dans le compose ; images non root, système de fichiers en lecture seule (RI-SEC-10).
6. **Secrets** : jamais en variable d'environnement de production (RI-SCR-01) ; montages de fichiers Coolify lus via `PV_<SERVICE>_<PARAMETRE>_FILE`, générés à l'initialisation, aucun secret par défaut (RI-SCR-07). Les variables Coolify ne portent que des valeurs non secrètes (dont `PV_VERSION`).
7. PostgreSQL (`pv-db`) sur volume nommé, avec sauvegarde planifiée.

### 7.2 Chaîne de livraison de chaque lot

1. PR fusionnée par squash sur `main`, CI verte.
2. release-please ouvre la PR de version (changelog généré) ; sa fusion crée le tag `vX.Y.Z` (ou `vX.Y.Z-rc.N`).
3. `release.yml` : construction multi-architecture, publication GHCR par OIDC, signature cosign, SBOM, provenance ; **approbation humaine de l'environnement de release** (RI-VER-06).
4. Job `deploy` : positionne `PV_VERSION` dans l'environnement Coolify (`recette` pour un `-rc`, `production` pour une version stable, avec approbation) et déclenche le déploiement par l'API de Coolify ; jeton Coolify stocké comme secret d'environnement GitHub, non exposé aux PR.
5. Côté VPS : **sauvegarde de la base**, puis migrations (job unique, avant les services), puis démarrage, puis contrôle `/readyz`.
6. Tests de fumée post-déploiement : `/readyz`, version exposée, un parcours Playwright du lot.
7. Publication de la documentation versionnée (`docs.yml`, §8).
8. Promotion : le `-rc.N` validé en recette est suivi du tag stable, déployé en production.

### 7.3 Retour arrière

Les migrations vont vers l'avant uniquement (RI-DON-04). **Redéployer l'image N-1 seule est interdit dès qu'une migration a été appliquée** : le retour arrière restaure la sauvegarde préalable, puis redéploie N-1 (RI-VER-04). Ce cas est décrit dans un runbook du manuel d'exploitation et testé à partir du lot 2.

### 7.4 Portée de l'environnement Coolify

Le VPS Coolify est un environnement de recette et de démonstration. Il ne remplace pas les livrables portables du lot 7 (installation sans droits administrateur, RI-VER-03). Le thème DSFR n'y est activé qu'après vérification de l'usage de l'identité de l'État ; sinon thème neutre (RI-DSF-08).

## 8. Documentation à chaque livraison

### 8.1 Génération et modification

| Élément | Nature | Quand | Contrôle |
|---|---|---|---|
| Référence : API, MCP, événements, erreurs, journal, configuration, données, permissions, règles, traçabilité | **Générée** par `tools/` depuis le code | À chaque PR ; commitée | La CI échoue si elle diffère (RI-DOC-03) |
| OpenAPI + Swagger UI | Générée | À chaque release, sur GitHub Pages | RI-DOC-07 |
| Dictionnaire des données | Généré (tbls + `COMMENT ON`) | À chaque migration | RI-DON-03 |
| Guide fonctionnel | Rédigé | Dans la PR de toute story qui change un comportement | RI-DOC-02 |
| ADR | Rédigée | Toute décision structurante | Relecture CODEOWNERS |
| Glossaire | Rédigé | Tout nouveau terme métier | RI-NOM-10 |
| DAG / DAD (fiche par service) | Rédigés | Création ou évolution d'un service | Diagrammes Mermaid validés |
| Installation, exploitation, runbooks | Rédigés | Lots concernés (§8.2) | Liens et orthographe en CI |
| Changelog | Généré (release-please) | À chaque release | RI-VER-01 |
| Notes de version, notes de migration, changements de configuration | Rédigées en français | À chaque release | RI-VER-02 |
| Déclaration d'accessibilité | Rédigée | À chaque release | RI-ACC-11 |

À chaque release : site VitePress publié sous `/v/<version>/` et `latest` ; PDF balisés des manuels ; front-matter, liens, orthographe et diagrammes valides (RI-DOC-06, RI-DOC-08).

### 8.2 Documentation attendue par lot

| Lot | Documentation livrée ou mise à jour |
|---|---|
| 0 | Contribution (environnement, architecture du code, tests, revue), glossaire initial, DAG initial, exploitation (déploiement Coolify, retour arrière), ADR de départ |
| 1 | Guide « Prise en main » (connexion, profil, MFA, clé API) ; API : authentification ; fiches DAD `identity`, `policy`, `audit`, `api-gateway` |
| 2 | Guide « Premier projet », clôture, archivage, suppression ; fiche `portfolio` |
| 3 | Guide éléments, workflows, backlog, board ; fiches `workitem`, `workflow`, `query` |
| 4 | Guide sprints, rapports, notifications ; fiches `planning`, `notification`, `delivery` |
| 5 | Manuels développeur API et MCP ; import et export ; fiches `mcp-gateway`, `approval`, `files` |
| 6 | Guide « Assistance IA et validations », profils de contexte, registre RGPD et AIPD ; fiches de la chaîne OpenFox |
| 7 | Installation Windows, Linux, macOS sans droits administrateur ; exploitation complète ; DAG et DAD complets ; dossier d'homologation ; manuel plugins ; PDF |
| 8–15 | Guide et fiches des fonctionnalités du lot ; manuel plugins (lots 10, 14) ; installation Helm (lot 12) |

## 9. Porte de livraison d'un lot

Un lot n'est livré que si tous les points suivants sont vérifiés :

1. Toutes les stories du lot respectent la définition de « terminé » (§24.3).
2. CI verte : couches, seuils, tests (unitaires, propriétés, intégration, contrats, autorisation, accessibilité, Gherkin), mutation, SAST, secrets, dépendances, compatibilité des contrats.
3. Test de montée de version depuis N-1 avec données (RI-TST-11).
4. Référence générée synchronisée ; documentation du §8.2 à jour.
5. Tag posé, approbation de l'environnement de release donnée.
6. Déploiement en recette réussi, tests de fumée verts, retour arrière vérifié.
7. Résultat vérifiable du §6.2 constaté sur le VPS.

## 10. Points de vigilance

| # | Point | Réf. |
|---|---|---|
| 1 | Décision de licence (C01) nécessaire avant la première PR de gouvernance | RI-GIT-05 |
| 2 | Certificats Authenticode et compte développeur Apple à acquérir avant le lot 7 | C03 |
| 3 | Vérification du nom et de la marque, et de l'usage du terme SAFe, avant la première diffusion publique | C04 |
| 4 | Source des binaires PostgreSQL redistribuables du mode portable, à qualifier par ADR avant le lot 7 | C10 |
| 5 | Contrat d'OpenFox (versions, capacités, licence, conservation) à établir avant le lot 6 | C07 |
| 6 | Approbations humaines CODEOWNERS sur les zones protégées : goulot probable aux lots 0 et 1 | RI-REV-03 |
| 7 | Test d'intrusion indépendant à planifier avant la 1.0 | RI-RGS-03 |
| 8 | Coolify pilote un démon conteneur classique : à consigner par ADR comme propre à la recette, hors livrables | RI-VER-03 |
