---
type: leçons
mise_a_jour: 2026-10-01
sources: [PR #255, sessions du 30/09 et du 01/10/2026]
---

# Leçons apprises

| Date | Incident | Cause | Règle retenue |
|---|---|---|---|
| 30/09 | Insertion du membre bloquée à l'initialisation | RLS forcée : `app.organisation_id` pas encore connu | Préallouer l'identifiant d'organisation dans le gestionnaire avant la transaction ([[base-et-rls]]) |
| 30/09 | Le compteur d'échecs de connexion ne progressait pas | Le retour arrière de transaction annulait l'incrément | Un refus métier qui doit laisser une trace se **commite** (`{ status: 'rejected' }`) au lieu de lever une erreur ([[authentification]]) |
| 30/09 | Construction Coolify échouait | Contexte de construction mal positionné | `base_directory` + `docker_compose_location` explicites ([[recette-coolify]]) |
| 30/09 | Erreurs CSP et `HeaderLinks` du DSFR en recette | Styles injectés par le DSFR, classe de liste manquante | Empreintes de styles + `style-src-attr` ; `fr-header__menu-links` ([[interface-dsfr]]) |
| 30/09 | Écritures de fichiers en échec (fsync), utilitaires instables | Disque D: défaillant | Déménagement sur G: ; contournements de [[poste-de-developpement]] |
| 30/09 | Commits non signables | Clé absente de l'agent SSH | Le mainteneur charge la clé ; ne jamais désactiver la signature |
| 30/09 | Dette de lint (seuils RI-COD-03) | Code écrit vite pendant le MVP | Cas d'usage `(dépendances, contexte, requête)` ; lint lancé avant chaque commit |
| 01/10 | Deux échecs de CI sur `main` | Résolution de conflit erronée en fusionnant #251 (PR empilées) : `tools/smoke` corrompu | Éviter les PR empilées ; après fusion d'une pile, relancer la CI de `main` et vérifier les fichiers en conflit ; corrigé par #255 |
| 01/10 | Poussée forcée refusée après `--amend` | Mode auto : réécriture d'historique distant interdite | Ne pas amender un commit poussé ; pousser sur une nouvelle branche si besoin |
| 01/10 | ESLint échouerait sur des `.mjs` hors `tsconfig` | `projectService` exige que chaque fichier lint appartienne à un projet TS | Exclure du lint les dossiers de scripts hors TS (`.claude/`, vault) ou les inclure dans un `tsconfig` |
| 01/10 | Couverture de tests quasi nulle (seuls `policy` et `tools/ci` ont des tests unitaires) | MVP livré en priorité au parcours, validé par les tests de fumée | Toute story touchant un service ajoute ses tests unitaires (RI-TST) ; dette à résorber par service |
| 01/10 | PR du vault fusionnées dans le désordre ; #262 ouverte depuis une branche périmée | PR interdépendantes ouvertes en parallèle ; ancienne branche laissée sur le dépôt | Une PR qui dépend d'une autre le dit en tête de description ; supprimer aussitôt une branche abandonnée |
| 01/10 | Fichier de configuration jamais écrit sans que l'erreur soit vue | Commande enchaînée par `&&` après un utilitaire Git Bash défaillant (`touch`) | Écrire les fichiers avec l'outil d'écriture ; vérifier l'existence avant de déboguer l'outil |
| 01/10 | cspell acceptait un commentaire anglais | Dictionnaires anglais activés par défaut pour TypeScript | Les retirer (`!typescript`, `!node`…) dans `languageSettings` ; sentinelle en CI |
| 01/10 | gitleaks : 4 faux positifs dans l'historique (`generic-api-key`) | Faux jeton du test de fumée, UUID d'exemple `Idempotency-Key` des spécifications | Exclure par empreinte exacte dans `.gitleaksignore` (jamais par chemin entier) ; reproduire en local avec l'image `ghcr.io/gitleaks/gitleaks:v8.30.1` |
| 01/10 | Règle Semgrep SQL aveugle aux appels `query<T>(…)` ; `semgrep --test <dossier>` réussissait sans tester | Le parseur TypeScript de Semgrep lit mal les appels génériques ; un dossier commençant par un point n'est pas parcouru | Règle en `pattern-regex` ; tests lancés avec `--config <règles> <fichier de cas>` ; vérifier qu'une règle échoue sur un cas positif avant de s'y fier |
| 01/10 | Le script `layers` appelait une configuration dependency-cruiser inexistante, sans que rien ne le signale | Script jamais lancé en CI | Tout script de contrôle de `package.json` est branché en CI, avec une sentinelle |
| 01/10 | Une sentinelle passait quand l'outil plantait | Test fondé sur le code de sortie, pas sur la règle déclenchée | Une sentinelle vérifie le nom de la règle attendue dans la sortie, et on la fait échouer volontairement une fois |
| 01/10 | Règle `sonarjs/super-linear-regex` | Expressions régulières à retour arrière | Préférer `startsWith`, `slice`, découpage par ligne |
