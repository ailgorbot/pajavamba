# Gouvernance du projet

## Rôles

| Rôle | Personnes | Responsabilités |
|---|---|---|
| Mainteneur | [@ailgorbot](https://github.com/ailgorbot) | Vision, priorisation du backlog, relecture et fusion, décisions d'architecture (ADR), publication des versions |
| Contributeur | Toute personne proposant une PR | Respect des [règles immuables](docs/regles-immuables.md) et de [CONTRIBUTING](CONTRIBUTING.md) |
| Agent de développement | Agents automatisés (ex. Claude Code) | Proposent des PR ; ne peuvent ni approuver ni fusionner (RI-REV-06, RI-GIT-04) |

## Décisions

| Sujet | Mode de décision |
|---|---|
| Story, correctif | Revue de PR : au moins une approbation humaine distincte de l'auteur (RI-REV-03) |
| Zone protégée (`packages/ops`, `packages/kernel`, `packages/contracts`, `packages/ui`, migrations, sécurité, `.github/`, `docs/specifications`, `docs/adr`, `docs/regles-immuables.md`) | Approbation d'un mainteneur désigné dans [`CODEOWNERS`](.github/CODEOWNERS) |
| Décision structurante | ADR dans `docs/adr/`, acceptée par un mainteneur (RI-DOC-04) |
| Règle immuable | ADR acceptée, approbation des mainteneurs et nouvelle version de `docs/regles-immuables.md` ; jamais dans une PR de fonctionnalité |
| Version publiée | Approbation humaine de l'environnement de release (RI-VER-06) |

## Évolution de la gouvernance

L'ajout d'un mainteneur ou la modification de ce document passe par une PR approuvée par les mainteneurs en place. La liste des mainteneurs est tenue à jour dans ce fichier et dans `CODEOWNERS`.

## Code de conduite

Toutes les interactions relèvent du [code de conduite](CODE_OF_CONDUCT.md).
