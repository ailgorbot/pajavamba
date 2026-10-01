---
titre: ADR-0007 — Vault de développement (mémoire des agents)
public: mainteneurs, développeurs, agents
statut: acceptée
version_min: 0.4.0
mise_a_jour: 2026-10-01
---

# ADR-0007 — Vault de développement

| Élément | Valeur |
|---|---|
| Statut | **Acceptée** le 01/10/2026 à la demande du mainteneur |
| Story | [L0-37](https://github.com/ailgorbot/pajavamba/issues/258) |
| Références | RI-DOC-01, RI-DOC-04, RI-REV-06, nouvelle règle RI-DOC-10 |

## Contexte

Le développement est mené en grande partie par des agents (Claude Code) dont le contexte est périodiquement compacté. Sans mémoire structurée, un agent redécouvre ce qui a été fait (lots, choix, incidents, contournements) ou, pire, contredit une décision déjà prise. Le code, `docs/` et GitHub contiennent la vérité, mais dispersée et coûteuse à relire à chaque session.

## Options

| Option | Avantages | Inconvénients |
|---|---|---|
| Relire code, `docs/` et GitHub à chaque session | Aucune duplication | Coûteux, lent ; les décisions de session et les leçons apprises ne sont écrites nulle part |
| Mémoire privée de l'agent (hors dépôt) | Simple | Invisible des contributeurs, non versionnée, liée à un poste |
| **Vault versionné selon la méthode LLM Wiki** (Karpathy) | Synthèse persistante, liée et cumulative ; versionnée ; lisible dans Obsidian | Doit être tenu à jour (tâche confiée à l'agent) |

## Décision

1. Le dossier `vault de développement/` à la racine du dépôt est un wiki tenu par les agents, en trois couches : **sources brutes** immuables (code, `docs/`, GitHub, instantanés datés dans `sources/`), **pages de synthèse** (lots, modules, concepts, décisions, GitHub, exploitation, leçons) et **schéma** (`SCHEMA.md`, et `CLAUDE.md` à la racine).
2. Trois opérations : **ingérer** (une source nouvelle met à jour toutes les pages concernées), **interroger** (répondre depuis le vault, puis classer les réponses utiles), **contrôler** (contradictions, pages orphelines, affirmations périmées).
3. `index.md` catalogue chaque page ; `log.md` est un journal chronologique en ajout seul, au format `## [AAAA-MM-JJ] opération | titre`.
4. Ordre de consultation : vault, puis code (qui **fait foi**), puis GitHub ; un doute persistant est levé auprès du mainteneur avec le skill `grill-me` (`.claude/skills/grill-me/`).
5. Mises à jour obligatoires : PR fusionnée, livraison de lot, décision, incident, et avant tout compactage de contexte (un crochet `PreCompact` ajoute un instantané automatique au journal ; un crochet `SessionStart` rappelle le vault).
6. Le vault ne contient ni secret, ni donnée personnelle, ni détail d'infrastructure de la recette : ces derniers restent dans `vault de développement/local/`, non versionné.

## Conséquences

- Nouvelle règle **RI-DOC-10** ; `docs/regles-immuables.md` passe en version 1.1.0.
- Le vault n'est pas de la documentation produit : `docs/` reste la source unique (RI-DOC-01) et le vault y renvoie.
- Toute divergence constatée entre le vault et le code se corrige dans le vault, avec une entrée `contrôle` dans `log.md`.
