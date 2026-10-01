---
name: grill-me
description: Interroger le mainteneur de PajaVamba, une question à la fois, pour lever un doute ou arrêter une décision avant d'agir. À utiliser quand le vault, le code et GitHub ne suffisent pas à trancher, ou quand le mainteneur demande d'être questionné sur un plan.
---

# Grill-me — lever les doutes avec le mainteneur

Objectif : parvenir à une compréhension partagée avant d'agir, en parcourant l'arbre des décisions branche par branche.

## Avant de poser une question

1. Chercher la réponse dans `vault de développement/` (index, puis pages), puis dans le code (qui fait foi), puis sur GitHub.
2. Ne poser que les questions auxquelles ces sources ne répondent pas, ou dont la réponse appartient au mainteneur (priorité, périmètre, licence, compromis, validation d'ADR).

## Déroulé

1. Lister mentalement les décisions ouvertes et leurs dépendances ; commencer par celle dont dépendent les autres.
2. Poser **une seule question à la fois** (outil `AskUserQuestion`), avec 2 à 4 options concrètes, l'option recommandée en premier et marquée « (recommandé) », et l'impact de chaque option.
3. Après chaque réponse : reformuler la décision en une phrase, signaler toute contradiction avec une décision antérieure du vault, puis passer à la branche suivante.
4. S'arrêter quand toutes les branches nécessaires à l'action sont tranchées ; ne pas interroger sur ce qui relève d'un choix par défaut évident.

## Après l'entretien

- Consigner chaque décision dans le vault : `decisions/journal-des-decisions.md` (date, question, réponse, conséquence) et une entrée `## [AAAA-MM-JJ] décision | …` dans `log.md`.
- Une décision structurante devient une ADR dans `docs/adr/` (RI-DOC-04).
