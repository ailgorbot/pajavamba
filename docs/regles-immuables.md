# PajaVamba — Règles immuables

| Élément | Valeur |
|---|---|
| Version du document | 1.2.0 (ajout de RI-SEC-14, ADR-0008 ; 1.1.0 : RI-DOC-10, ADR-0007) |
| Date | 01/10/2026 |
| Document associé | `PajaVamba_Specifications_Techniques.md` (références « § ») |
| Emplacement cible dans le dépôt | `docs/regles-immuables.md` |
| Langue | Français |

## Statut et gouvernance

1. Ce document liste les règles auxquelles **aucune contribution ne déroge**, quels que soient l'auteur (personne ou agent), l'urgence ou la taille de la modification.
2. Il **prévaut** sur les spécifications techniques et sur toute autre documentation.
3. Une PR qui enfreint une règle est refusée. Aucune exception ponctuelle, aucun « correctif temporaire ».
4. Une règle ne se modifie que par : une ADR acceptée, l'approbation humaine des mainteneurs désignés dans `CODEOWNERS`, et une nouvelle version de ce document. Jamais au sein d'une PR de fonctionnalité ou de correctif.
5. Un identifiant `RI-…` n'est jamais réutilisé ; une règle retirée reste listée avec la mention « retirée » et la référence de l'ADR.
6. Colonne « Contrôle » : **CI** = vérification automatique bloquante ; **Test** = test automatisé obligatoire ; **Revue** = vérification en revue de code ; **Doc** = livrable documentaire exigé ; **Processus** = étape de gouvernance.

**Zones protégées** (relecture humaine CODEOWNERS obligatoire) : `packages/ops`, `crates/pv-ops`, `packages/kernel`, `packages/contracts`, `packages/ui`, politiques Cedar, migrations, profils de contexte, configuration de sécurité, `.github/`, `docs/specifications`, `docs/adr`, `docs/regles-immuables.md`.

---

## 1. Architecture et couches (ARC)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-ARC-01 | Chaque service est découpé en trois couches : haute (OPS : `packages/ops` ou `crates/pv-ops`), moyenne (`services/<s>/structure`), basse (`services/<s>/fonctionnel`). | CI | §5.3 |
| RI-ARC-02 | Les dépendances vont dans un seul sens : `structure` → `fonctionnel` → `kernel`. La couche basse n'importe jamais la couche moyenne ni OPS. | CI | §5.3.2 |
| RI-ARC-03 | La couche fonctionnelle n'importe aucun framework, pilote de base de données, client HTTP, bibliothèque de journalisation ni Zod ; son `package.json` ne déclare aucune dépendance d'exécution. | CI | §5.3 |
| RI-ARC-04 | OPS ne contient aucune connaissance métier et ne dépend d'aucun code du projet. | CI, Revue | §5.3.1 |
| RI-ARC-05 | Aucune règle métier dans la couche moyenne, OPS, les passerelles, les services techniques ou l'interface. | Revue | §5.3.1 |
| RI-ARC-06 | Un cas d'usage correspond à exactement une action du registre ; il retourne `{ result, events }` et ne produit aucun effet de bord caché. | Revue | §5.3.4 |
| RI-ARC-07 | L'`ExecutionContext` est transmis explicitement ; aucun état global, aucun contexte implicite. | Revue | §5.3.4 |
| RI-ARC-08 | Dans `fonctionnel/`, sont interdits : `Date`, `Date.now`, `Math.random`, `crypto`, `process`, `console`, minuteries, modules `node:*`, tout accès réseau ou fichier. L'heure et les identifiants passent par les ports `Clock` et `IdGenerator`. | CI | §19.1 |
| RI-ARC-09 | Câblage manuel dans la racine de composition ; ni décorateurs, ni conteneur d'injection de dépendances. | Revue | §5.3.6 |
| RI-ARC-10 | Toute décision d'autorisation passe par le port `AccessPolicy` ; aucune vérification de droits codée en dur. | Revue | §5.3.3 |
| RI-ARC-11 | L'agrégat, ses événements et l'entrée d'audit sont écrits dans la même transaction (outbox). | Test | §5.3.4 |
| RI-ARC-12 | Stack limitée à TypeScript, Rust et PostgreSQL. Ni Python dans le produit, ni Angular, ni NestJS, ni autre base de données. | CI, Revue | §5.1, H10 |
| RI-ARC-13 | Rust n'est introduit que pour un besoin justifié (performance, isolation, sécurité) par ADR ; TypeScript par défaut. | Revue | P03 |

## 2. Répartition des fonctionnalités et services (SRV)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-SRV-01 | Chaque service est seul propriétaire de son schéma. Aucun accès au schéma d'un autre service, aucune jointure ni clé étrangère entre schémas. | CI | §4.5 |
| RI-SRV-02 | Aucun import de code entre services ; seuls `packages/kernel` et `packages/contracts` sont partagés. | CI | §4.4 |
| RI-SRV-03 | Au plus un saut synchrone derrière la passerelle ; aucune chaîne d'appels synchrones entre services. | Revue | §4.4 |
| RI-SRV-04 | Aucune transaction distribuée ; les traitements multi-services sont des sagas avec compensation. | Revue | §4.4 |
| RI-SRV-05 | Les services techniques ne portent aucune règle métier et ne possèdent aucune donnée métier. | Revue | §4.2 |
| RI-SRV-06 | Aucun service central d'accès aux données. | Revue | §4.5 |
| RI-SRV-07 | Les vues consolidées inter-contextes sont servies uniquement par `query`. | Revue | §4.5 |
| RI-SRV-08 | Tout service est sans état et réplicable horizontalement. | Revue | §4.6 |
| RI-SRV-09 | Le regroupement en unités de déploiement est une configuration ; un appel entre services d'une même unité passe par le client du contrat. | Revue | §4.3 |
| RI-SRV-10 | Seul `openfox-adapter` connaît OpenFox. | CI | §12.2 |
| RI-SRV-11 | Les consommateurs d'événements sont idempotents ; l'ordre par agrégat est respecté. | Test | §5.7 |
| RI-SRV-12 | Tout appel sortant utilise le client d'OPS (délai, reprises bornées, disjoncteur). | CI, Revue | §4.6 |
| RI-SRV-13 | Chaque fonctionnalité est affectée à un seul service propriétaire, conformément au §4.2 ; tout nouveau service ou changement de propriétaire passe par ADR. | Revue | §4.2 |

## 3. Codage et état de l'art (COD)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-COD-01 | TypeScript en mode strict avec toutes les options du §19.1 ; aucune option désactivée. | CI | §19.1 |
| RI-COD-02 | Interdits : `any`, `as` sans justification, assertion non nulle `!`, `enum`, `namespace`, `export default`, fichiers fourre-tout (`utils`, `helpers`, `common`). | CI | §19.1 |
| RI-COD-03 | Seuils : fonction ≤ 30 lignes ; ≤ 3 paramètres ; complexité cyclomatique ≤ 10 ; cognitive ≤ 15 ; imbrication ≤ 3 ; fichier ≤ 300 lignes ; aucun bloc dupliqué de plus de 10 lignes. | CI | §19.2 |
| RI-COD-04 | Tout identifiant est typé (branded type en TS, newtype en Rust) ; jamais une chaîne brute. | Revue | §19.1, §19.3 |
| RI-COD-05 | Erreurs métier par `Result` ; exceptions réservées aux erreurs techniques. | Revue | §5.3.5 |
| RI-COD-06 | Immutabilité par défaut ; aucun paramètre muté. | CI | §19.1 |
| RI-COD-07 | `switch` exhaustifs sur les unions ; aucune promesse flottante. | CI | §19.1 |
| RI-COD-08 | Rust : édition 2024, `clippy -D warnings` avec `pedantic`, `#![forbid(unsafe_code)]`, `#![deny(missing_docs)]` ; ni `unwrap`, ni `expect`, ni `panic!` en code de production. | CI | §19.3 |
| RI-COD-09 | SQL uniquement paramétré ; aucune requête construite par concaténation de chaînes. | CI | §16.2 |
| RI-COD-10 | Toute nouvelle dépendance est justifiée (usage, maintenance, licence autorisée, sécurité) ; fichiers de verrouillage obligatoires et installation figée. | CI, Revue | §16.4 |
| RI-COD-11 | Ni code mort, ni code commenté. | CI | §19.5 |
| RI-COD-12 | Validation des entrées par Zod uniquement dans la couche moyenne, avec schémas fermés (champs inconnus rejetés). | Revue | §5.3.1 |
| RI-COD-13 | Aucun nombre ni chaîne magique hors constantes nommées. | CI | §19.2 |
| RI-COD-14 | Toute désactivation d'une règle de lint est ponctuelle, justifiée en commentaire et validée en revue. | Revue | §19.2 |
| RI-COD-15 | Les invariants métier vivent dans les entités et objets valeur ; composition plutôt qu'héritage ; aucune abstraction prématurée. | Revue | §19.6 |
| RI-COD-16 | Les conditions de workflow, automatisations et configurations sont déclaratives ; aucun code arbitraire n'est exécuté à partir de données utilisateur. | Revue | §3.5 |

## 4. Commentaires (COM)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-COM-01 | Les commentaires sont rédigés en français. | CI (cspell), Revue | §19.5 |
| RI-COM-02 | Un commentaire explique le pourquoi (intention, contrainte, règle), jamais la paraphrase du code. | Revue | §19.5 |
| RI-COM-03 | Chaque module a un en-tête : rôle, couche, règles référencées. | CI | §19.5 |
| RI-COM-04 | Tout élément exporté a une documentation TSDoc ou rustdoc (rôle, paramètres, retour, erreurs). | CI | §19.5 |
| RI-COM-05 | Toute règle de gestion implémentée cite son identifiant `RG-…`. | CI | §19.9 |
| RI-COM-06 | Aucun `TODO` sans ticket (`TODO(#123)`). | CI | §19.5 |
| RI-COM-07 | Modifier le code impose de mettre à jour les commentaires concernés. | Revue | §19.5 |

## 5. Nommage (NOM)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-NOM-01 | Identifiants de code en anglais ; commentaires, documentation, messages, libellés, erreurs et noms de tests en français. | Revue | H01 |
| RI-NOM-02 | Dossiers d'architecture en français : `structure/`, `fonctionnel/`, `domaine/`, `cas-usage/`, `ports/`, `regles/`. | CI | H02, §5.2 |
| RI-NOM-03 | Casse : `camelCase` (variables, fonctions), `PascalCase` (types), `UPPER_SNAKE_CASE` (constantes), `snake_case` (Rust, SQL). | CI | §20.1 |
| RI-NOM-04 | Fichiers en `kebab-case` avec suffixe de rôle (`.use-case.ts`, `.port.ts`, `.repository.ts`, `.action.ts`, `.schema.ts`, `.event.ts`…) ; un concept principal par fichier. | CI | §20.2 |
| RI-NOM-05 | Base : tables au pluriel en `snake_case`, clé primaire `id`, clés étrangères `<entité>_id`, préfixes `pk_`, `fk_`, `ux_`, `ix_`, `ck_`. | CI | §20.3 |
| RI-NOM-06 | API : chemins au pluriel en `kebab-case`, champs JSON en `camelCase`, valeurs énumérées en `snake_case`. | CI | §20.4 |
| RI-NOM-07 | Action `<ressource>.<action>` ; permission `<ressource>:<action>` ; outil MCP `<ressource>_<action>` ; événement `pv.<service>.<objet>.<verbe_passé>.v<N>` ; erreur `<service>.<motif>`. | CI | §20.4 |
| RI-NOM-08 | Variables d'environnement `PV_<SERVICE>_<PARAMETRE>` ; secrets en fichier suffixés `_FILE`. | CI | §20.5 |
| RI-NOM-09 | Branches `<type>/<ticket>-<description>` ; commits Conventional Commits (type anglais, portée = service, description française). | CI | §20.5 |
| RI-NOM-10 | Un concept porte un seul nom partout, conforme au glossaire. | Revue | §20.6, annexe A |
| RI-NOM-11 | Les identifiants `RG-`, `EXG-`, `ADR-`, `RI-` ne sont jamais réutilisés. | CI | §0.2 |

## 6. Tests (TST)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-TST-01 | La couche fonctionnelle est testée sans aucune entrée/sortie ; couverture de branches ≥ 90 %. | CI | §19.7 |
| RI-TST-02 | Score de mutation ≥ 80 % sur la couche fonctionnelle. | CI | §19.7 |
| RI-TST-03 | Tout calcul (capacité, WSJF, hiérarchie, workflow, métriques) est couvert par des tests de propriétés. | Revue | §19.7 |
| RI-TST-04 | Chaque port a une suite de contrat exécutée sur l'adaptateur en mémoire et sur l'adaptateur PostgreSQL. | CI | §19.7 |
| RI-TST-05 | Les tests d'intégration utilisent un PostgreSQL réel avec RLS ; la base n'est jamais simulée pour la couche moyenne. | CI | §19.7 |
| RI-TST-06 | Chaque action a des tests d'autorisation générés (rôle × canal × niveau). | CI | §16.5 |
| RI-TST-07 | Chaque critère d'acceptation a un scénario Gherkin en français, exécuté. | CI | §19.8 |
| RI-TST-08 | Tests déterministes : horloge et identifiants injectés ; aucune dépendance à l'ordre d'exécution ni à un réseau externe. | Revue | §19.7 |
| RI-TST-09 | Aucune fusion avec un test ignoré, désactivé ou instable sans ticket associé. | CI | §19.10 |
| RI-TST-10 | Tests à valeurs sentinelles (jetons, données personnelles, données S) sur journaux, erreurs, traces et flux vers l'IA. | CI | §15.6, §13.2 |
| RI-TST-11 | Test de montée de version depuis N-1 avec données à chaque release. | CI | §22.1 |
| RI-TST-12 | Noms de tests en français, forme « étant donné…, quand…, alors… ». | Revue | §19.7 |

## 7. Revue de code (REV)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-REV-01 | Aucun push direct sur `main` ; toute modification passe par une PR. | CI | §23.1 |
| RI-REV-02 | Une PR = une story ou un correctif ; ≤ 400 lignes modifiées hors fichiers générés. | CI | §19.10 |
| RI-REV-03 | Au moins une approbation humaine distincte de l'auteur ; approbation CODEOWNERS sur les zones protégées. | CI | §19.10 |
| RI-REV-04 | Tous les contrôles CI sont verts ; aucun contournement. | CI | §19.10 |
| RI-REV-05 | Le modèle de PR est entièrement renseigné (story, règles, documentation, sécurité, données, accessibilité, migration). | CI | §19.10 |
| RI-REV-06 | Un agent automatisé ne peut ni approuver ni fusionner ; une revue outillée ne remplace pas la revue humaine des zones protégées. | CI | §23.4 |
| RI-REV-07 | Fusion par squash, historique linéaire, commits signés. | CI | §19.10 |
| RI-REV-08 | Une PR qui enfreint une règle immuable est refusée, sans exception d'urgence. | Revue | Gouvernance |

## 8. Documentation (DOC)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-DOC-01 | Toute la documentation est en français, dans `docs/` du dépôt GitHub, source unique. | Revue | §21.1 |
| RI-DOC-02 | Une PR qui modifie un comportement met à jour la documentation dans la même PR. | Revue | §21.1 |
| RI-DOC-03 | La référence (API, MCP, événements, erreurs, journal, configuration, données, permissions, règles, traçabilité) est générée depuis le code, jamais écrite à la main ; la CI échoue si elle est désynchronisée. | CI | §21.5 |
| RI-DOC-04 | Toute décision structurante fait l'objet d'une ADR. | Revue | §21.2 |
| RI-DOC-05 | Le jeu documentaire obligatoire est tenu à jour : guide fonctionnel (de la prise en main à la clôture et l'archivage), installation Windows, Linux, macOS sans droits administrateur, exploitation, manuels développeur API, MCP et plugins, spécifications, DAG, DAD, glossaire et dictionnaire des données. | Doc | §21.3 |
| RI-DOC-06 | Front-matter obligatoire ; liens, orthographe et diagrammes valides. | CI | §21.5 |
| RI-DOC-07 | L'OpenAPI est publié sur GitHub Pages avec Swagger UI à chaque release. | CI | §10.9 |
| RI-DOC-08 | Documentation versionnée par release ; PDF balisés et accessibles. | CI | §21.5 |
| RI-DOC-09 | Aucune clé ou donnée réelle dans la documentation et les exemples. | CI | §9.6 |
| RI-DOC-10 | Le `vault de développement/` (méthode LLM Wiki) est la mémoire secondaire des agents : pour toute question sur le projet, un agent le consulte en premier, puis le code (qui fait foi en cas de divergence) et GitHub ; un doute persistant est levé en interrogeant le mainteneur (skill `grill-me`). Le vault est mis à jour à chaque PR fusionnée, livraison de lot, décision, incident et avant tout compactage de contexte, avec une entrée dans `log.md`. Il résume `docs/` et y renvoie sans la remplacer (RI-DOC-01). | Processus | ADR-0007 |
| RI-DOC-10 | Le code produit la documentation de l'état ; la documentation rédigée porte l'intention (pas de duplication manuelle de la référence). | Revue | P13 |

## 9. Sécurité (SEC)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-SEC-01 | L'autorisation est vérifiée côté serveur à chaque requête ; jamais dans l'interface seule. | Test | §7.6 |
| RI-SEC-02 | Un refus explicite prévaut sur toute autorisation. | Test | §7.2 |
| RI-SEC-03 | Une ressource inaccessible répond comme une ressource inexistante (404). | Test | §6.3 |
| RI-SEC-04 | Aucune fonctionnalité exposée sans authentification, hors `/healthz`, `/readyz`, métadonnées OAuth et pages de connexion. | Test | §16.1 |
| RI-SEC-05 | Aucune cryptographie maison ; algorithmes du §16.3 ; TLS 1.2 minimum. | Revue | §16.3 |
| RI-SEC-06 | CSP stricte et en-têtes de sécurité du §16.2 ; aucun `dangerouslySetInnerHTML` hors composant de rendu Markdown audité ; Markdown rendu avec liste blanche. | CI | §16.2 |
| RI-SEC-07 | Tout appel vers une URL fournie par un utilisateur applique les protections SSRF du §10.6. | Test | §10.6 |
| RI-SEC-08 | Fichiers : type réel vérifié, types dangereux refusés, clé de stockage aléatoire, taille limitée. | Test | §5.10 |
| RI-SEC-09 | SAST, secrets, dépendances et images sont bloquants en CI. | CI | §16.5 |
| RI-SEC-10 | Images de conteneur minimales, non root, système de fichiers en lecture seule. | CI | §16.4 |
| RI-SEC-11 | SBOM, signatures et provenance pour tout livrable. | CI | §16.4 |
| RI-SEC-12 | Les vulnérabilités sont signalées en privé ; jamais par une issue publique. | Processus | §16.6 |
| RI-SEC-13 | Toutes les exigences OWASP ASVS niveau 2 retenues sont couvertes par des tests. | CI | §16.1 |
| RI-SEC-14 | Avant chaque livraison de code sur GitHub, l'auteur (personne ou agent) exécute l'audit Semgrep complet (`node tools/semgrep/audit-semgrep.ts` : règles du projet et jeux officiels, image épinglée). Chaque constat confirmé devient une issue « [Semgrep] » et est corrigé ; un faux positif est annoté `nosemgrep` avec sa justification ; une vulnérabilité exploitable suit RI-SEC-12. Une erreur d'analyse se traite comme un constat. | Processus | ADR-0008 |

## 10. Secrets, jetons, clés et identifiants (SCR)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-SCR-01 | Aucun secret en clair dans le code, la configuration versionnée, une image, un journal, une erreur, une trace, une URL ou une variable d'environnement de production. | CI, Test | §9.4 |
| RI-SCR-02 | Jetons au format `pvb_<type>_<id public>_<secret>_<somme>` ; préfixes réservés du §9.1. | Test | §9.2 |
| RI-SCR-03 | Seule l'empreinte HMAC-SHA-256 avec poivre serveur est stockée ; la valeur n'est affichée qu'une fois. | Test | §9.3 |
| RI-SCR-04 | Un jeton n'est accepté qu'en en-tête `Authorization` ; un jeton dans l'URL provoque un refus 400 et un événement d'audit. | Test | §8.4 |
| RI-SCR-05 | Secrets applicatifs chiffrés par enveloppe AES-256-GCM (clé par organisation, données associées). | Revue | §9.3 |
| RI-SCR-06 | Les clés des fournisseurs LLM ne sont accessibles qu'à `llm-egress-proxy`. | Revue | §12.4 |
| RI-SCR-07 | Aucun mot de passe ni secret par défaut ; tout est généré à l'installation. | Test | §9.4 |
| RI-SCR-08 | Une révocation prend effet en moins de 5 secondes. | Test | EXG-PERF-006 |
| RI-SCR-09 | Tout secret est issu d'un générateur cryptographiquement sûr. | Revue | §16.3 |
| RI-SCR-10 | Les identifiants et clés de projet ne sont jamais traités comme des secrets ni comme une preuve d'autorisation. | Revue | §9.7 |
| RI-SCR-11 | Chaque secret de l'inventaire a une procédure de rotation documentée. | Doc | §9.5 |

## 11. Connexion (CNX)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-CNX-01 | Aucun fournisseur d'identité maison ; SSO via IdP (OIDC, SAML) ; comptes locaux et serveur d'autorisation OAuth via bibliothèques éprouvées. | Revue | §8.1 |
| RI-CNX-02 | Mots de passe : argon2id, 12 caractères minimum, contrôle contre les mots de passe compromis, aucun renouvellement périodique imposé. | Test | §8.1 |
| RI-CNX-03 | MFA (WebAuthn, TOTP) disponible et exigible par politique ; MFA de moins de 15 minutes pour toute action R3. | Test | §8.3 |
| RI-CNX-04 | Cookie `__Host-pv_session` `Secure`, `HttpOnly`, `SameSite=Lax` ; jeton CSRF sur toute requête modifiante authentifiée par cookie. | Test | §8.3 |
| RI-CNX-05 | Accès programmatique = clé personnelle + identifiant de projet ; les droits sont recalculés à chaque appel ; la clé n'encode aucun droit. | Test | §8.4 |
| RI-CNX-06 | Un jeton court de projet est limité à un projet, un mode et 24 heures au plus. | Test | §8.5 |
| RI-CNX-07 | Un compte de service est rattaché à un projet ; jamais de compte humain partagé. | Revue | §8.6 |
| RI-CNX-08 | OAuth 2.1 avec PKCE ; jetons d'accès de 15 minutes liés à l'audience ; rotation des jetons de rafraîchissement ; enregistrement dynamique désactivé par défaut. | Test | §8.7 |
| RI-CNX-09 | Messages d'échec de connexion uniformes ; limitation progressive sans verrouillage définitif. | Test | §8.1 |
| RI-CNX-10 | La désactivation d'un utilisateur révoque immédiatement ses sessions, sa clé et ses jetons. | Test | RG-IAM-005 |
| RI-CNX-11 | La chaîne de vérification du §8.8 est appliquée intégralement à chaque requête. | Test | §8.8 |

## 12. Rôles et habilitations (HAB)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-HAB-01 | Chaque action référence exactement une permission du catalogue et un niveau de risque (R0 à R3). | CI | §7.3 |
| RI-HAB-02 | Les actions R3 ne sont accessibles que depuis l'interface avec MFA récente ; jamais par clé, jeton, agent ou plugin. | Test | RG-IAM-003 |
| RI-HAB-03 | Droits d'un délégué = droits de l'utilisateur ∩ droits du délégué ∩ politique ; jamais plus que l'utilisateur. | Test | RG-IAM-001 |
| RI-HAB-04 | Tout appel reçu par le serveur MCP est traité comme délégué. | Test | §7.8 |
| RI-HAB-05 | Une action R2 déléguée exige une validation humaine. | Test | §7.3 |
| RI-HAB-06 | Un agent ou un plugin n'approuve jamais une demande de validation. | Test | RG-APR-001 |
| RI-HAB-07 | Le niveau de risque d'une action peut être durci par l'organisation, jamais assoupli sous le catalogue. | Test | §7.3 |
| RI-HAB-08 | Le vote de confiance n'est jamais délégable. | Test | RG-OBJ-003 |
| RI-HAB-09 | Un accès invité a toujours une date d'expiration. | Test | RG-IAM-004 |
| RI-HAB-10 | Les politiques Cedar sont versionnées et testées par jeux de décisions attendues. | CI | §7.5 |
| RI-HAB-11 | Les champs sont filtrés selon leur classe après la décision d'autorisation. | Test | §7.6 |
| RI-HAB-12 | Tous les refus sont audités. | Test | §7.6 |

## 13. API

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-API-01 | Registre d'actions unique ; routes REST, outils MCP, SDK et documentation en sont générés. | CI | §10.1 |
| RI-API-02 | Parité : l'interface n'utilise que l'API publique, via le client généré. | CI | §10.1 |
| RI-API-03 | Conventions du §10.2 : JSON UTF-8 `camelCase`, dates ISO 8601 UTC, pagination par curseur (200 maximum), aucune liste non bornée. | CI | §10.2 |
| RI-API-04 | Erreurs au format RFC 9457, en français, avec code documenté ; aucun détail interne ni trace de pile. | Test | §10.4 |
| RI-API-05 | `If-Match` obligatoire sur `PATCH` et `DELETE` ; `Idempotency-Key` obligatoire sur les écritures `POST` ; `dryRun` disponible sur toute écriture. | Test | §10.2 |
| RI-API-06 | Aucun changement cassant dans une version majeure ; `openapi-diff` bloquant ; version précédente maintenue 12 mois. | CI | §10.5 |
| RI-API-07 | Webhooks signés (Standard Webhooks), contenu fin, champs supplémentaires limités au consentement. | Test | §10.6 |
| RI-API-08 | Les événements externes sont fins ; le détail se récupère via l'API sous contrôle des droits. | Revue | §5.7 |
| RI-API-09 | CORS par liste blanche ; jamais `*` avec identifiants ; aucun cookie accepté en cross-origin. | Test | §10.7 |
| RI-API-10 | Les SDK sont générés, jamais écrits à la main. | CI | §10.8 |
| RI-API-11 | Limites de débit appliquées ; opérations en masse plafonnées à 500 éléments. | Test | §10.2 |
| RI-API-12 | Aucune clé réelle ne se saisit dans un éditeur Swagger hébergé par un tiers ; la consigne figure dans le manuel développeur. | Doc | §10.9 |

## 14. MCP

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-MCP-01 | Le serveur MCP n'implémente aucune logique métier ; ses outils sont générés depuis le registre. | CI | §11.1 |
| RI-MCP-02 | Toutes les actions permises à l'utilisateur sont exposées, à l'exception des actions R3. | Test | §11.1 |
| RI-MCP-03 | `tools/list` est dynamique selon les droits et la portée ; notification lors des changements. | Test | §11.4 |
| RI-MCP-04 | Outils étroits orientés intention ; aucun outil renvoyant « tout le contexte ». | Revue | §11.4 |
| RI-MCP-05 | Toute sortie MCP passe par le Context Gateway. | Test | §11.1 |
| RI-MCP-06 | Le texte libre renvoyé est marqué `untrusted`. | Test | §11.6 |
| RI-MCP-07 | Une écriture qui suit la lecture de contenu tiers dans la même session passe en validation humaine. | Test | §11.6 |
| RI-MCP-08 | `dryRun` et `idempotencyKey` sur toute écriture ; plafonds par action et par session. | Test | §11.6 |
| RI-MCP-09 | Chaque appel est audité (utilisateur, agent, session, outil, empreinte des paramètres, décision, validation, résultat). | Test | §11.6 |
| RI-MCP-10 | La validation humaine se fait dans l'interface de PajaVamba, hors du canal de l'agent. | Revue | §11.5 |
| RI-MCP-11 | Aucun « prompt » MCP n'est exposé. | Revue | §11.4 |
| RI-MCP-12 | Un jeton court de projet n'est accepté que sur le point d'accès de ce projet. | Test | §11.3 |
| RI-MCP-13 | La version du protocole est épinglée ; sa montée passe par ADR. | Revue | §11.2 |

## 15. Plugins (PLG)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-PLG-01 | Un plugin est une identité distincte ; ses droits = consentement ∩ droits de l'utilisateur. | Test | §14.5 |
| RI-PLG-02 | Aucune action R3 accessible à un plugin ; les actions R2 exigent une validation humaine. | Test | §14.5 |
| RI-PLG-03 | Toute augmentation de permissions ou de classes de données exige un nouveau consentement. | Test | RG-PLG-001 |
| RI-PLG-04 | Le manifeste est validé par schéma ; toute clé inconnue est refusée. | CI | §14.3 |
| RI-PLG-05 | Extensions d'interface : `iframe` sandbox sans `allow-same-origin` ni `allow-top-navigation`, `postMessage` avec origine vérifiée, jeton court de projet ; jamais d'accès au cookie de session. | Test | §14.5 |
| RI-PLG-06 | Extensions WASM : ni réseau ni fichier par défaut ; limites de mémoire, de temps et de carburant. | Test | §14.5 |
| RI-PLG-07 | Pools, files et quotas séparés par plugin et par organisation ; appel synchrone ≤ 2 secondes avec disjoncteur. | Test | §14.6 |
| RI-PLG-08 | Le contenu provenant d'un plugin est marqué non fiable pour les agents. | Test | §14.5 |
| RI-PLG-09 | Les extensions d'interface officielles respectent le RGAA et les jetons DSFR. | CI | §14.8 |
| RI-PLG-10 | La désinstallation révoque les jetons, supprime les abonnements et purge le stockage du plugin. | Test | §14.4 |

## 16. Séparation et imbrication avec OpenFox (OFX)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-OFX-01 | **Règle d'or** : ne jamais envoyer au LLM tout ce que l'on possède ; lui envoyer uniquement ce dont il a besoin, au moment où il en a besoin. | Test, Revue | P09 |
| RI-OFX-02 | PajaVamba n'embarque aucune IA (LLM, RAG, embeddings, mémoire d'agent). | Revue | H12 |
| RI-OFX-03 | OpenFox n'est jamais forké ; PajaVamba ne dépend que de son contrat versionné. | Revue | P01, P02 |
| RI-OFX-04 | OpenFox n'accède jamais à la base de PajaVamba ; uniquement API, MCP et événements. | Revue | §12.1 |
| RI-OFX-05 | PajaVamba est la source de vérité ; OpenFox ne l'est jamais. | Revue | P07 |
| RI-OFX-06 | Le contexte est tiré par l'agent, jamais poussé ; les événements vers OpenFox sont fins et sans contenu. | Test | §12.3 |
| RI-OFX-07 | Tout contexte transmis passe par un profil déclaratif et versionné ; tout champ non listé est refusé. | Test | §12.3 |
| RI-OFX-08 | Divulgation progressive : N0 ou N1 par défaut, niveau supérieur sur demande explicite et pour des éléments précis. | Test | §12.3 |
| RI-OFX-09 | Les calculs (capacité, métriques, WSJF, chemin critique) sont faits par PajaVamba ; l'IA n'est jamais la source d'un chiffre de référence. | Revue | §12.3 |
| RI-OFX-10 | Personnes et équipes pseudonymisées ; la table de correspondance reste dans PajaVamba. | Test | §12.3 |
| RI-OFX-11 | Détection de données personnelles sur tout texte libre avant envoi. | Test | §12.3 |
| RI-OFX-12 | Budget de jetons et envoi par différences ; classement plutôt que troncature arbitraire. | Test | §12.3 |
| RI-OFX-13 | Chaque livraison de contexte est inscrite au journal du contexte. | Test | §12.3 |
| RI-OFX-14 | Données de classe S jamais envoyées à un fournisseur externe ; classe X jamais transmise. | Test | RG-IA-001 |
| RI-OFX-15 | L'interrupteur d'urgence coupe immédiatement tout envoi. | Test | §12.3 |
| RI-OFX-16 | Tout résultat d'OpenFox est ré-autorisé par PajaVamba avant affichage. | Test | §12.5 |
| RI-OFX-17 | Tout contenu produit par l'IA est marqué ; les actions R1 d'un agent sont annulables. | Test | §12.8 |
| RI-OFX-18 | PajaVamba fonctionne intégralement sans OpenFox. | Test | §12.7 |
| RI-OFX-19 | Tout champ transmissible à l'IA figure dans un profil, et réciproquement. | CI | §6.7 |
| RI-OFX-20 | La recherche sémantique est désactivée par défaut et soumise au post-filtrage. | Test | §12.5 |

## 17. Compatibilité LLM et sortie (LLM)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-LLM-01 | PajaVamba n'appelle aucun LLM. | Revue | §13 |
| RI-LLM-02 | Tout appel LLM d'OpenFox transite par `llm-egress-proxy`, qui injecte les clés des fournisseurs. | Revue | §12.4 |
| RI-LLM-03 | Fournisseurs relayés : OpenAI, Anthropic (Claude), Ollama et compatibles OpenAI ; liste blanche par organisation et par classe de données. | Test | §13.1 |
| RI-LLM-04 | Le proxy contrôle et relaie ; il ne traduit pas les formats. | Revue | §12.4 |
| RI-LLM-05 | Par défaut, modèle local ou hébergé dans l'Union européenne ; un fournisseur hors Union européenne n'est activé qu'après encadrement déclaré. | Revue | §13.1 |

## 18. Journalisation (LOG)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-LOG-01 | Un journal structuré unique, émis exclusivement par OPS ; la couche fonctionnelle ne journalise jamais. | CI | §15.1 |
| RI-LOG-02 | Trois niveaux de détail cumulatifs (fonctionnel, technique, debug), distincts de la sévérité. | Revue | §15.1 |
| RI-LOG-03 | Toute entrée provient du catalogue versionné ; aucun message libre. | CI | §15.2 |
| RI-LOG-04 | Messages de journal en français. | CI | §15.2 |
| RI-LOG-05 | Jamais de texte libre, de donnée personnelle en clair, de donnée S ou X, à aucun niveau. | CI, Test | §15.1 |
| RI-LOG-06 | Masquage par liste blanche ; les exceptions tierces sont classées, jamais écrites brutes. | Test | §15.6 |
| RI-LOG-07 | Écriture asynchrone et non bloquante ; en saturation, abandon du debug puis du technique, mesuré. | Test | §15.4 |
| RI-LOG-08 | Debug : permission R3, justification, portée limitée (service, corrélation ou utilisateur), 30 minutes par défaut, 4 heures maximum, audité ; jamais sur toute l'instance. | Test | §15.5 |
| RI-LOG-09 | Attributs obligatoires du §15.3, dont corrélation et trace. | CI | §15.3 |
| RI-LOG-10 | Journal applicatif, journal d'audit et journal du contexte IA restent distincts. | Revue | §15.1 |
| RI-LOG-11 | Accès par niveau selon les permissions ; conservations du §15.7. | Test | §15.7 |
| RI-LOG-12 | Caractères de contrôle échappés (protection contre l'injection dans les journaux). | Test | §15.6 |

## 19. Audit (AUD)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-AUD-01 | L'audit est écrit dans la transaction métier via l'outbox. | Test | §16.7 |
| RI-AUD-02 | Journal chaîné, ancré, vérifiable, en lecture seule, sans suppression avant échéance. | Test | §16.7 |
| RI-AUD-03 | Sont audités : authentification, gestion des accès, refus, actions R2 et R3, délégations, validations, debug, exports, plugins, lecture de l'audit. | Test | §16.7 |
| RI-AUD-04 | Aucune valeur D, S ou X en clair : noms des champs et empreintes uniquement. | Test | §6.5.8 |

## 20. Données et base (DON)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-DON-01 | Un schéma par service ; rôle d'exécution (DML, sans `BYPASSRLS`) et rôle de migration distincts. | CI | §5.6 |
| RI-DON-02 | `organisation_id` et Row-Level Security forcée sur toute table métier. | CI | §5.6 |
| RI-DON-03 | Toute table et colonne a un `COMMENT ON` en français ; tout champ a une classe (P, I, D, S, X), une exposition IA et une conservation. | CI | §6.7 |
| RI-DON-04 | Migrations vers l'avant, immuables après fusion, en expansion puis contraction ; aucune suppression de données dans la version du changement ; `DROP` et `TRUNCATE` interdits sans ADR. | CI, Revue | §5.6 |
| RI-DON-05 | Aucune mise à jour ne remet à blanc les données ni l'historique ; sauvegarde automatique avant montée de version. | Test | P15 |
| RI-DON-06 | UUIDv7 générés par l'application ; `timestamptz` en UTC ; dates métier avec fuseau explicite. | Revue | §5.6 |
| RI-DON-07 | Énumérations en `text` + `CHECK` ; pas de type `ENUM`. | CI | §5.6 |
| RI-DON-08 | Toute clé étrangère est indexée. | CI | §5.6 |
| RI-DON-09 | Verrouillage optimiste par version d'agrégat ; aucun verrou global. | Revue | §4.6 |
| RI-DON-10 | Clé de projet immuable ; identifiants jamais réattribués ; numéros d'éléments jamais réutilisés. | Test | RG-PRJ-001, RG-WI-001 |
| RI-DON-11 | Événements au format CloudEvents, type versionné, schéma publié, compatibilité vérifiée. | CI | §5.7 |
| RI-DON-12 | Conservation et purge automatiques selon le §6.6. | Test | §6.6 |
| RI-DON-13 | Le texte libre est traité comme susceptible de contenir des données personnelles. | Revue | §6.1 |

## 21. RGPD

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-RGPD-01 | Minimisation : aucune donnée non nécessaire (pas de motif d'absence, votes agrégés, journaux sans texte libre). | Revue | §17.3 |
| RI-RGPD-02 | Aucune métrique ni évaluation individuelle de performance ; aucun classement de personnes. | Revue, Test | RG-IA-002 |
| RI-RGPD-03 | Droits des personnes outillés : export, rectification, effacement par pseudonymisation dans l'historique, opposition aux traitements IA. | Test | §17.3 |
| RI-RGPD-04 | Cookies strictement nécessaires uniquement ; aucun traceur tiers. | CI | §17.3 |
| RI-RGPD-05 | Aucune donnée personnelle en `localStorage`. | CI | §5.4 |
| RI-RGPD-06 | Transferts hors Union européenne déclarés et encadrés avant activation. | Revue | §17.3 |
| RI-RGPD-07 | Sous-traitants documentés ; le consentement d'un plugin indique les données transférées et la localisation de l'éditeur. | Doc | §17.3 |
| RI-RGPD-08 | Protection par défaut : profils IA étendus et recherche sémantique désactivés par défaut. | Test | §17.3 |
| RI-RGPD-09 | Registre, AIPD et procédure de violation (72 heures) fournis et tenus à jour. | Doc | §17.3 |

## 22. RGAA (ACC)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-ACC-01 | Toute interface vise la conformité totale au RGAA 4.1.2 (ou version en vigueur) ; zéro violation axe en CI. | CI | §17.1 |
| RI-ACC-02 | Navigation complète au clavier, focus visible, liens d'évitement. | Test | §17.1 |
| RI-ACC-03 | Tout glisser-déposer a une alternative au clavier et une action « Déplacer vers… ». | Test | §17.1 |
| RI-ACC-04 | Tout graphique a une alternative tabulaire. | Test | §3.7 |
| RI-ACC-05 | Information jamais portée par la seule couleur ; contrastes conformes. | Revue | §17.1 |
| RI-ACC-06 | Zoom à 200 % et affichage à 320 px sans perte. | Test | §17.1 |
| RI-ACC-07 | Mises à jour temps réel annoncées sobrement par `aria-live`. | Revue | §17.1 |
| RI-ACC-08 | Formulaires : étiquettes visibles, champs obligatoires signalés, erreurs reliées aux champs. | Test | §17.1 |
| RI-ACC-09 | Raccourcis clavier désactivables et reconfigurables. | Test | §17.1 |
| RI-ACC-10 | ARIA uniquement lorsque le HTML natif ne suffit pas. | Revue | §17.1 |
| RI-ACC-11 | Déclaration d'accessibilité et schéma pluriannuel à jour à chaque release ; test au lecteur d'écran à chaque release. | Doc, Processus | §17.1 |

## 23. RGS (RGS)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-RGS-01 | Analyse de risques EBIOS RM tenue à jour ; dossier type d'homologation fourni. | Doc | §17.2 |
| RI-RGS-02 | Cryptographie, authentification et journalisation conformes au RGS et aux guides de l'ANSSI. | Revue | §17.2 |
| RI-RGS-03 | DAST à chaque release ; test d'intrusion indépendant avant la version 1.0 puis annuellement. | Processus | §16.5 |
| RI-RGS-04 | Aucune dépendance imposée à un hébergeur particulier. | Revue | §17.2 |

## 24. RGI (RGI)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-RGI-01 | UTF-8 partout. | CI | §17.4 |
| RI-RGI-02 | Formats ouverts (JSON, CSV RFC 4180, ISO 8601, ODS, Markdown) ; aucun format propriétaire bloquant. | Revue | §17.4 |
| RI-RGI-03 | Standards : OpenAPI 3.1, CloudEvents, AsyncAPI, OpenID Connect, SAML, SCIM, OAuth 2.1, RFC 9457. | CI | §17.4 |
| RI-RGI-04 | Export complet de projet documenté et versionné (réversibilité). | Test | §3.9 |
| RI-RGI-05 | Contrats publiés et versionnés à chaque release. | CI | §22.2 |

## 25. Ergonomie et expérience utilisateur (ERG)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-ERG-01 | Cohérence : mêmes composants, termes du glossaire et emplacements d'actions sur tous les écrans. | Revue | §18.3 |
| RI-ERG-02 | Toute action irréversible demande une confirmation explicite rappelant l'objet ; toute opération en masse propose une simulation. | Test | §18.3 |
| RI-ERG-03 | Annulation pendant 10 secondes des actions R1 destructives ; corbeille de 30 jours. | Test | §18.3 |
| RI-ERG-04 | Messages d'erreur en français : ce qui s'est passé, comment corriger, code, lien vers la documentation. | Test | §18.3 |
| RI-ERG-05 | États vides avec explication et action principale. | Revue | §18.3 |
| RI-ERG-06 | Mise à jour optimiste avec retour arrière et message en cas d'échec. | Revue | §18.3 |
| RI-ERG-07 | Une seule fenêtre modale à la fois, avec gestion du focus. | Test | §18.3 |
| RI-ERG-08 | Budgets de performance du §5.14 respectés. | CI | EXG-WEB-001 |
| RI-ERG-09 | Une proposition de l'IA n'est jamais appliquée silencieusement : différences, « Appliquer », « Modifier », « Refuser » ; provenance marquée. | Test | §18.4 |
| RI-ERG-10 | L'indisponibilité d'OpenFox est signalée sans bloquer l'usage. | Test | §18.4 |
| RI-ERG-11 | Dates au format français ; fuseau affiché lorsqu'il diffère. | Revue | §18.3 |
| RI-ERG-12 | Chaque parcours clé a un test de bout en bout et fait l'objet d'un test d'utilisabilité lorsqu'il évolue. | CI, Processus | §18.5 |

## 26. Thème et DSFR (DSF)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-DSF-01 | Le DSFR est le système de design de référence ; le gabarit Site Blanc DSFR sert de modèle de structure. | Revue | §18.1 |
| RI-DSF-02 | Aucun import direct du DSFR ou de React Aria hors `packages/ui`. | CI | §18.1 |
| RI-DSF-03 | Aucune couleur, taille ou marge codée en dur : jetons DSFR uniquement ; classes spécifiques préfixées `pv-`. | CI | §18.1 |
| RI-DSF-04 | Composants DSFR en priorité ; composants complexes construits avec React Aria et stylés avec les jetons DSFR. | Revue | §18.1 |
| RI-DSF-05 | Thèmes clair, sombre et système via les paramètres d'affichage du DSFR. | Test | §18.1 |
| RI-DSF-06 | Icônes du DSFR uniquement. | Revue | §18.1 |
| RI-DSF-07 | En-tête et pied de page DSFR avec liens obligatoires (accessibilité, mentions légales, données personnelles). | Revue | §18.1 |
| RI-DSF-08 | L'usage de l'identité de l'État est vérifié pour chaque déploiement ; un thème neutre reste substituable via la façade. | Revue | §18.1, C02 |

## 27. Versionnement et livraison (VER)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-VER-01 | SemVer ; Conventional Commits ; changelog et étiquettes générés. | CI | §22.1 |
| RI-VER-02 | Chaque release livre : archives Windows x64, Linux x64 et arm64, macOS arm64 ; images OCI ; compose ; SDK ; contrats ; documentation ; SBOM ; `SHA256SUMS` ; signatures ; provenance. | CI | §22.2 |
| RI-VER-03 | Installation, mise à jour et désinstallation possibles sans droits administrateur : répertoires de l'utilisateur, ports supérieurs à 1024, aucun lien symbolique (`current.txt`). | CI (3 systèmes) | §21.4 |
| RI-VER-04 | Mise à jour : sauvegarde automatique, migrations, bascule ; retour arrière par restauration. | Test | §21.4 |
| RI-VER-05 | Binaires signés (Authenticode, notarisation Apple, cosign). | CI | §21.4 |
| RI-VER-06 | Publication conditionnée à tous les contrôles et à l'approbation humaine de l'environnement de release. | CI | §22.3 |
| RI-VER-07 | Écoute sur `127.0.0.1` par défaut ; toute exposition réseau exige TLS. | Test | §21.4 |
| RI-VER-08 | Politique de support et chemins de mise à jour du §22.1 respectés. | Processus | §22.1 |

## 28. GitHub et CI (GIT)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-GIT-01 | GitHub est la source ; règles de branche sur `main` : PR, approbation, CODEOWNERS, contrôles requis, historique linéaire, commits signés, aucun push forcé. | CI | §23.1 |
| RI-GIT-02 | Secret scanning avec protection des pushs et motif `pvb_` ; Dependabot ; CodeQL ; signalement privé des vulnérabilités. | CI | §23.3 |
| RI-GIT-03 | Actions épinglées par SHA ; permissions minimales ; aucun `pull_request_target` exécutant du code de PR ; publication par OIDC. | CI | §23.2 |
| RI-GIT-04 | Les agents interviennent par PR uniquement, sous une GitHub App aux permissions minimales, sans pouvoir approuver ni fusionner. | CI | §23.4 |
| RI-GIT-05 | Fichiers de gouvernance présents et à jour (`README`, `LICENSE`, `SECURITY`, `CONTRIBUTING`, `CODE_OF_CONDUCT`, `GOVERNANCE`, `CODEOWNERS`). | CI | §23.1 |
| RI-GIT-06 | Toute story suit le modèle (« En tant que…, je veux…, afin de… », critères Gherkin, règles, données, accessibilité). | Processus | §23.1 |

## 29. Performance et scalabilité (PRF)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-PRF-01 | Services sans état, réplicables horizontalement. | Revue | §4.6 |
| RI-PRF-02 | Lectures lourdes via `query` et réplicas ; pagination par curseur. | Revue | §4.6 |
| RI-PRF-03 | Autorisation évaluée localement (WASM) avec cache invalidé par événements. | Revue | §4.6 |
| RI-PRF-04 | Pools de connexions plafonnés par service ; PgBouncer en topologie serveur. | Revue | §5.6 |
| RI-PRF-05 | Files par type de tâche, contre-pression, priorités, limites par organisation, client et action. | Revue | §4.6 |
| RI-PRF-06 | Intégrations externes isolées ; leur lenteur n'atteint jamais les services métier. | Revue | §4.6 |
| RI-PRF-07 | Cibles `EXG-PERF` vérifiées par tests de charge à chaque release. | CI | §5.14 |
| RI-PRF-08 | Journalisation hors du chemin critique des requêtes. | Test | §15.4 |

## 30. Invariants métier (MET)

| ID | Règle | Contrôle | Réf. |
|---|---|---|---|
| RI-MET-01 | Le cycle de vie d'un projet n'admet que les transitions du §2.4 ; aucune clôture forcée. | Test | RG-PRJ-003, RG-PRJ-005 |
| RI-MET-02 | Un projet clôturé, archivé ou en suppression programmée est en lecture seule. | Test | RG-PRJ-004 |
| RI-MET-03 | La purge n'intervient qu'à l'échéance du délai de grâce ; l'audit est conservé avec des références pseudonymisées. | Test | RG-PRJ-007 |
| RI-MET-04 | Types, hiérarchies, workflows et méthodologies sont configurables, jamais figés dans le code ; SAFe est natif mais non exclusif. | Revue | P05, P06 |
| RI-MET-05 | Une version de workflow publiée est immuable. | Test | RG-WF-001 |
| RI-MET-06 | Un élément confidentiel n'est visible qu'avec la permission dédiée. | Test | RG-WI-007 |
| RI-MET-07 | Les métriques sont calculées au niveau équipe, projet, train ou portefeuille, jamais au niveau d'une personne. | Test | §3.7 |
| RI-MET-08 | Une action est définie une seule fois et exposée identiquement en interface, API et MCP. | CI | P12 |

---

*Toute évolution de ce document suit la procédure de gouvernance ci-dessus.*
