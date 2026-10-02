---
type: journal
---

<!-- Les fusions de PR qui ajoutent chacune une entrée peuvent coller deux entrées : tolérance des lignes vides. -->
<!-- markdownlint-disable MD022 MD032 -->

# Journal du vault

Ajout seul. Format : `## [AAAA-MM-JJ] opération | titre` (voir [[SCHEMA]]).

## [2026-09-29] ingestion | Amorçage du dépôt et du backlog

- Dépôt public `ailgorbot/pajavamba`, commit initial non signé (spécifications, règles immuables, marque).
- 247 stories publiées (16 jalons, lots 0 à 15) dans le projet n° 2. Voir [[processus-github]].

## [2026-09-30] livraison | MVP 0.4.0 (lots 0 à 3)

- PR empilées #249 (socle), #248 (identité), #250/#252 (projets), #251/#253 (éléments), fusionnées le 30/09. Voir [[historique-des-pr]].
- Recette déployée sur Coolify, initialisée et validée par le mainteneur (« Le MVP est OK »). Voir [[recette-coolify]].
- 70 stories passées à Done. ADR-0001 à 0006 rédigées ; ADR-0006 (écarts du MVP) reste proposée.

## [2026-09-30] incident | Disque D: défaillant

- Copie de travail déplacée vers `G:\Claude\PajaVamba` ; Node et Git Bash encore sur D:. Voir [[poste-de-developpement]], [[lecons-apprises]].

## [2026-10-01] incident | Outils de fumée cassés par la fusion du lot 3

- Résolution de conflit erronée dans #251 ; corrigé par #255 (CI verte). Voir [[lecons-apprises]].

## [2026-10-01] livraison | Gouvernance et modèles de contribution

- #256 (L0-08) : SECURITY, CONTRIBUTING, CODE_OF_CONDUCT, GOVERNANCE, CODEOWNERS ; #257 (L0-09) : modèles de PR et de tickets, contrôle CI du modèle de PR. Fusionnées par le mainteneur.

## [2026-10-01] décision | Vault de développement (RI-DOC-10)

- Le mainteneur demande un vault LLM Wiki comme mémoire secondaire des agents, consulté en premier, mis à jour à chaque livraison et avant compactage. ADR-0007, RI-DOC-10, story [#258](https://github.com/ailgorbot/pajavamba/issues/258), PR #259 (règle et outillage).

## [2026-10-01] ingestion | Amorçage du vault

- Ingestion initiale : code (`main` = b632cb7), `docs/`, ADR 0001 à 0007, projet GitHub n° 2, historique des PR, décisions et incidents des sessions du 29/09 au 01/10. Toutes les pages de [[index]] créées.

## [2026-10-01] livraison | Vault fusionné (#259 à #262)

- #261 fusionnée avant #260 ; #260 a échoué au lint tant que #259 manquait (corrigé en fusionnant `main`) ; #262, doublon issu de l'ancienne branche, fusionnée à vide. Story #258 fermée. Voir [[historique-des-pr]].
- Décision d'organisation : désormais, chaque PR de story embarque sa propre mise à jour du vault (comme RI-DOC-02 pour `docs/`).

## [2026-10-01] ingestion | L0-14 hygiène du dépôt (en cours)

- gitleaks (règle `pajavamba-token`, pré-commit `.githooks/`, job CI sur tout l'historique), cspell (français ; commentaires du code vérifiés sans dictionnaires anglais), markdownlint (5 corrections). Voir [[processus-github]], [[lecons-apprises]].

## [2026-10-01] livraison | L0-14 fusionnée (#263)

- Faux positifs gitleaks traités par `.gitleaksignore` (empreintes). Voir [[lecons-apprises]].

## [2026-10-01] ingestion | L0-16 sécurité bloquante (en cours)

- `security.yml` : Semgrep en conteneur avec règles du projet et tests, audit des dépendances avec sentinelle ; interpolations d'identifiants de `withTransaction` justifiées. Voir [[processus-github]], [[ops]].

## [2026-10-01] décision | Audit Semgrep à chaque livraison (RI-SEC-14)

- Le mainteneur demande d'inscrire en règle immuable l'audit Semgrep du code avant chaque livraison, avec issues et corrections, et un audit de tout le code existant. ADR-0008, RI-SEC-14, story [#271](https://github.com/ailgorbot/pajavamba/issues/271). Voir [[audit-semgrep]].

## [2026-10-01] audit | Premier audit Semgrep complet

- 6 constats et 2 erreurs d'analyse (jeux officiels) : #265 (AES-GCM, PR #268), #266 (pnpm/npm, PR #269), #267 (faux positif, erreurs d'analyse, PR #270) ; 11 interpolations SQL corrigées en requêtes littérales dans #264. Rapport : [[2026-10-01-audit-semgrep-initial]].

## [2026-10-01] décision | Adoption progressive de Prettier (ADR-0009)

- Question posée avec grill-me : reformater tout le code ferait dépasser 30 lignes à 56 fonctions. Choix du mainteneur : Prettier largeur 200, vérifié en CI sur les seuls fichiers modifiés par une PR. L0-13 complétée dans #275 (dependency-cruiser, sentinelles, Prettier progressif). Voir [[journal-des-decisions]], [[architecture-en-couches]].

## [2026-10-01] audit | Injection dans ci.yml détectée sur #275

- `run-shell-injection` sur l'étape Prettier (`${{ github.base_ref }}` dans `run:`), poussée avant lecture du résultat d'audit ; issue #276, corrigée par `env: BASE_REF`. Leçon : conditionner la poussée au code de sortie de l'audit. Voir [[lecons-apprises]], [[audit-semgrep]].

## [2026-10-01] livraison | L0-16, corrections Semgrep et RI-SEC-14 fusionnées

- #264 (L0-16), #268 (AES-GCM), #269 (pnpm/npm), #270 (faux positifs), #272 (RI-SEC-14, ADR-0008) fusionnées, toutes vérifications vertes. Voir [[historique-des-pr]].

## [2026-10-01] audit | Audit Semgrep de contrôle sur main

- `main` = `1a53b40` : 0 constat, 0 erreur d'analyse. Jeux officiels ajoutés à la CI planifiée (#273). Voir [[audit-semgrep]].

## [2026-10-01] décision | Audit DAST OWASP ZAP (RI-SEC-15)

- Le mainteneur demande le même parcours que Semgrep avec ZAP ; choix : pile locale et CI, analyse passive de la recette à chaque livraison de lot. ADR-0010, story [#277](https://github.com/ailgorbot/pajavamba/issues/277). Voir [[audit-zap]].

## [2026-10-01] audit | Premier audit ZAP (local et recette)

- Local : COEP absent (#278), cache `max-age=0` (#279), régression 500 détectée pendant la correction ; 0 constat après corrections. Recette (passif) : COEP et cache, couverts par les mêmes corrections. Suite : parcours authentifiés (#280). Rapport : [[2026-10-01-audit-zap-initial]].

## [2026-10-01] incident | Rapport ZAP de la recette publié par erreur

- #281 a inclus `.zap/rapports/rapport-zap.json` (adresse de la recette, en-têtes ; aucun secret) et `.zap/zap.yaml` ; retirés par #284. La CI de #282 a relu ce rapport périmé ; script corrigé (suppression préalable, droits du dossier). Voir [[lecons-apprises]], [[audit-zap]].

## [2026-10-02] ingestion | L0-17 titres de PR et release-please

- Workflow `pr` (titre Conventional Commits + modèle, relancé à l'édition), release-please configuré en français mais inactif tant que le mainteneur n'a pas autorisé Actions à créer des PR et posé `RELEASE_PLEASE_ACTIF`. Voir [[processus-github]].

## [2026-10-02] livraison | Recette redéployée et réanalysée

- #281, #282, #283, #284 fusionnées ; recette redéployée sur `e799ced` (POST `/deploy`). Analyse ZAP passive : COEP et cache corrigés, 1 faux positif 10015 justifié (#285). Voir [[audit-zap]], [[recette-coolify]].

## [2026-10-02] ingestion | L0-18 publication (release.yml, docs.yml)

- Image GHCR multi-plateforme signée (cosign sans clé), SBOM CycloneDX et provenance attestés, environnement `release` à protéger par le mainteneur ; `docs.yml` vérifie la documentation et publiera sur Pages après activation. Voir [[processus-github]].
## [2026-10-02] incident | Journal collé après la fusion de #286 et #287

- Deuxième occurrence (après #275) : markdownlint échouait sur `main`. Tolérance MD022/MD032 dans `log.md`, `merge=union` dans `.gitattributes`. Voir [[lecons-apprises]].

## [2026-10-02] livraison | Première publication de la documentation

- `docs.yml` lancé manuellement à la demande du mainteneur : publié, mais en Markdown brut (racine en 404). Correctif : rendu HTML par `jekyll-build-pages`. Réglages vérifiés : Actions peut créer des PR, Pages actif ; restent l'environnement `release` et `RELEASE_PLEASE_ACTIF`. Voir [[processus-github]].
