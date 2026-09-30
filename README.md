<p align="center"><img src="docs/public/marque/pajavamba-icon-128x128.png" alt="" width="96" /></p>

# PajaVamba

Plateforme de gestion de projets agiles (Scrum, Kanban, Scrumban, SAFe à venir), conforme au DSFR et au RGAA, conçue pour fonctionner intégralement sans IA.

**Version en cours : 0.4.0 (MVP, lots 0 à 3)** — connexion, organisation et rôles, projets et cycle de vie complet, équipes, éléments de travail et hiérarchie, workflows versionnés, backlog, board accessible au clavier, recherche plein texte française, journal d'activité, audit chaîné.

## Documentation

| Document | Contenu |
|---|---|
| [Règles immuables](docs/regles-immuables.md) | Règles auxquelles aucune contribution ne déroge (elles prévalent sur tout) |
| [Spécifications techniques](docs/specifications/technique/specifications-techniques.md) | Référence fonctionnelle et technique |
| [Décomposition du développement](docs/developpeur/contribuer/decomposition-du-developpement.md) | Lots, ordre de construction, livraison |
| [Architecture du code](docs/developpeur/contribuer/architecture-du-code.md) | Organisation du monorepo et flux d'une écriture |
| [Prise en main](docs/fonctionnel/prise-en-main.md) | Guide utilisateur du MVP |
| [Déploiement Coolify](docs/exploitation/deploiement-coolify.md) | Installation, secrets, sauvegarde, retour arrière |
| [Référence des actions](docs/reference/actions.md) | Routes de l'API (générée depuis le code) |
| [ADR](docs/adr/) | Décisions d'architecture |

## Démarrage rapide

```bash
docker compose -f deploy/compose/compose.yaml up --build
```

Puis récupérer le code d'initialisation (`docker compose -f deploy/compose/compose.yaml exec pv-app cat /secrets/setup_code`) et ouvrir l'application. Pour un poste de développement : Node.js 24, pnpm 10, `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`.

## Contribuer

Toute modification passe par une PR (≤ 400 lignes, une story), avec CI verte et relecture humaine. Commits Conventional Commits en français ([ADR-0003](docs/adr/0003-conventions-git.md)). Suivi : [projet GitHub « PajaVamba Iterative development »](https://github.com/users/ailgorbot/projects/2).

## Licence

En attente de décision ([ADR-0001](docs/adr/0001-licence-du-coeur.md)).
