# Contribuer à PajaVamba

Merci de votre intérêt ! Les [règles immuables](docs/regles-immuables.md) prévalent sur tout le reste : une contribution qui en enfreint une est refusée, sans exception.

## Avant de commencer

1. Choisissez une story du [projet « PajaVamba Iterative development »](https://github.com/users/ailgorbot/projects/2) (ou ouvrez un ticket avec le modèle adapté).
2. Lisez les [spécifications techniques](docs/specifications/technique/specifications-techniques.md), l'[architecture du code](docs/developpeur/contribuer/architecture-du-code.md) et la [décomposition du développement](docs/developpeur/contribuer/decomposition-du-developpement.md).

## Environnement

- Node.js 24, pnpm 10, Docker ou Podman ([ADR-0002](docs/adr/0002-versions-figees.md)).
- `pnpm install --frozen-lockfile`
- `docker compose -f deploy/compose/compose.yaml up --build` pour la pile complète.
- `git config core.hooksPath .githooks` active le pré-commit qui bloque les secrets ([gitleaks](https://github.com/gitleaks/gitleaks) 8.30.1 à installer).
- Orthographe : un terme technique légitime refusé par `pnpm spell` s'ajoute à `.cspell/mots-projet.txt`.

## Règles de contribution

| Sujet | Règle |
|---|---|
| Périmètre | Une PR = une story ou un correctif, ≤ 400 lignes hors fichiers générés (RI-REV-02) |
| Branche | `<type>/<n° issue>-<description>` (ex. `feat/91-creer-element`) |
| Commits | Conventional Commits, type en anglais, description en français, **signés** ([ADR-0003](docs/adr/0003-conventions-git.md)) |
| Titre de PR | `type(portée): description` — devient le message du commit de fusion ; vérifié par le workflow `pr` (types et portées d'ADR-0003, description en minuscule, sans point final) |
| Versions | release-please propose une PR de version (changelog en français, SemVer) ; sa fusion reste une décision du mainteneur |
| Langue | Identifiants en anglais ; commentaires, documentation, messages et tests en français (RI-NOM-01) |
| Architecture | Couches `fonctionnel` → `structure` → OPS, aucun import entre services (RI-ARC-01 à RI-ARC-04, RI-SRV-02) |
| Qualité | Fonctions ≤ 30 lignes, ≤ 3 paramètres, complexité ≤ 10 (RI-COD-03) ; aucun `any`, `enum`, `export default` |
| Documentation | Mise à jour dans la même PR que le comportement modifié (RI-DOC-02) ; référence régénérée (`pnpm reference`) |
| Revue | Au moins une approbation humaine ; CODEOWNERS sur les zones protégées ; fusion par squash |

## Avant d'ouvrir la PR

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm reference:check
pnpm spell
pnpm lint:md
```

Puis remplissez **toutes** les sections du modèle de PR (story, règles, documentation, sécurité, données, accessibilité, migration).

## Agents automatisés

Un agent (par exemple Claude Code) intervient uniquement par PR ; il ne peut ni approuver ni fusionner (RI-REV-06, RI-GIT-04).

## Licence

En contribuant, vous acceptez que votre contribution soit publiée sous licence [Apache-2.0](LICENSE).
