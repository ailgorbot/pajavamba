---
type: schéma
mise_a_jour: 2026-10-01
---

# Schéma du vault de développement

Ce vault est la **mémoire secondaire des agents** qui développent PajaVamba (règle RI-DOC-10, [ADR-0007](../docs/adr/0007-vault-de-developpement.md)). Il suit la méthode LLM Wiki d'Andrej Karpathy : l'agent ne relit pas toutes les sources à chaque question, il entretient un wiki de synthèses liées qui s'enrichit à chaque livraison.

## Trois couches

| Couche | Contenu | Qui écrit |
|---|---|---|
| Sources brutes | Code du dépôt, `docs/`, GitHub (issues, PR, projet n° 2), échanges avec le mainteneur ; instantanés datés dans `sources/` | Personne ne les modifie : on les lit (un instantané daté n'est jamais réécrit) |
| Wiki | Pages de synthèse : `synthese/`, `lots/`, `modules/`, `concepts/`, `decisions/`, `github/`, `exploitation/`, `lecons/` | L'agent, entièrement |
| Schéma | Ce fichier et `CLAUDE.md` à la racine du dépôt | Mainteneur et agent, par PR |

**Hiérarchie de vérité** : le code fait foi, puis `docs/` et GitHub, puis le vault. Le vault ne remplace pas `docs/` (RI-DOC-01) : il résume et renvoie.

## Conventions des pages

- Une page = une entité (module, lot, ADR, incident) ou un concept ; nom de fichier en minuscules, sans accent, avec tirets.
- Front-matter : `type` (synthèse, lot, module, concept, décision, github, exploitation, leçons, source, généré), `mise_a_jour` (AAAA-MM-JJ), `sources` (chemins ou liens qui fondent la page).
- Liens internes au format Obsidian `[[nom-de-page]]` ; liens vers le dépôt en chemins relatifs (`../../services/identity/`) ; issues et PR en liens GitHub complets.
- Une affirmation non vérifiée porte la mention « à vérifier » ; une contradiction entre sources porte la mention « contradiction » et les deux références.
- Ni secret, ni donnée personnelle, ni détail d'infrastructure de recette (adresse, identifiants Coolify) : ceux-ci vont dans `local/` (non versionné).
- Pages générées (`type: généré`) : jamais modifiées à la main, régénérées par `outils/`.

## Opérations

### Ingérer (après une PR fusionnée, un lot livré, une décision, un incident)

La mise à jour du vault voyage **dans la PR de la story** qu'elle décrit (comme la documentation, RI-DOC-02) ; l'ingestion des fusions intervenues entre-temps se fait dans la PR suivante.

1. Lire la source (diff de la PR, ADR, réponse du mainteneur, journal d'erreur).
2. Mettre à jour toutes les pages concernées : lot, modules touchés, concepts, décisions, leçons, [[etat-du-projet]]. Une source touche souvent 5 à 15 pages.
3. Régénérer [[etat-des-stories]] (`node "vault de développement/outils/instantane-github.mjs"`) si des statuts ont changé.
4. Ajouter la page à [[index]] si elle est nouvelle.
5. Ajouter une entrée à [[log]].

### Interroger (avant de répondre ou d'agir)

1. Lire [[index]], puis les pages utiles.
2. Vérifier dans le code ce qui conditionne l'action (le code fait foi) ; compléter par GitHub.
3. Si un doute subsiste ou si la décision appartient au mainteneur : skill `grill-me`.
4. Une réponse utile et durable devient une page ou complète une page existante (entrée `interrogation` dans [[log]]).

### Contrôler (à chaque livraison de lot, ou sur demande)

Chercher les contradictions entre pages, les affirmations périmées par le code, les pages orphelines (aucun lien entrant), les concepts cités sans page, les stories dont le statut a changé. Corriger, puis entrée `contrôle` dans [[log]].

### Avant un compactage de contexte

Faire le point sans attendre : travail en cours, décisions de la session, prochaine étape dans [[etat-du-projet]] et entrée `compactage` dans [[log]]. Le crochet `PreCompact` ajoute de toute façon un instantané mécanique (branche, commits) à compléter à la reprise.

## Journal

[[log]] est en ajout seul. Plusieurs PR ouvertes en parallèle y ajoutent chacune une entrée : en cas de conflit, garder les deux entrées (`.gitattributes` applique `merge=union` aux fusions locales ; le fichier tolère deux entrées collées). Chaque entrée commence par `## [AAAA-MM-JJ] opération | titre`, avec `opération` parmi : `ingestion`, `interrogation`, `contrôle`, `décision`, `incident`, `compactage`, `livraison`, `audit` (audit Semgrep, RI-SEC-14). Dernières entrées : `grep "^## \[" "vault de développement/log.md" | tail -5`.
