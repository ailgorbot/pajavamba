---
type: synthèse
mise_a_jour: 2026-10-01
sources: [docs/developpeur/contribuer/architecture-du-code.md, package.json, arborescence de main]
---

# Carte du dépôt

| Chemin | Contenu | Page |
|---|---|---|
| `packages/kernel` | Noyau typé, ports communs | [[kernel]] |
| `packages/contracts` | Permissions, registre d'actions, événements | [[contracts]] |
| `packages/ops` | Couche haute : config, journal, HTTP, base, migrateur, secrets, chaîne d'écriture | [[ops]] |
| `packages/ui` | Façade DSFR | [[ui]] |
| `services/<s>/fonctionnel` | Domaine, ports, cas d'usage (aucune E/S) | [[architecture-en-couches]] |
| `services/<s>/structure` | Migrations, dépôts, actions, consommateurs, composition | idem |
| `apps/web` | Interface React | [[web]] |
| `deploy/units/pv-app` | Câblage des services, secrets, migrations | [[pv-app-et-compose]] |
| `deploy/compose` | `Dockerfile`, `compose.yaml` | idem |
| `tools/` | Référence générée, tests de fumée, contrôle du modèle de PR | [[outillage]] |
| `docs/` | Documentation produit (source unique, RI-DOC-01) | [[catalogue-des-sources]] |
| `.github/` | CI, CODEOWNERS, modèles | [[processus-github]] |
| `CLAUDE.md`, `.claude/` | Consignes des agents, skill grill-me, crochets du vault | [[SCHEMA]] |
| `vault de développement/` | Ce vault | [[index]] |

Services : [[identity]], [[policy]], [[portfolio]], [[workflow]], [[workitem]], [[query]], [[audit]], [[event-relay]], [[api-gateway]].

## Commandes

| Commande | Effet |
|---|---|
| `pnpm install --frozen-lockfile` | Installation figée |
| `pnpm typecheck` | Types stricts (couche fonctionnelle sans types Node) |
| `pnpm test` | Tests unitaires (projet `unit` de Vitest) |
| `pnpm lint` | ESLint strict + sonarjs, seuils RI-COD-03 |
| `pnpm reference` / `pnpm reference:check` | Régénère / vérifie `docs/reference/actions.md` |
| `pnpm build:web` | Construit l'interface |
| `docker compose -f deploy/compose/compose.yaml up --build` | Pile complète |
| `node tools/smoke/smoke-test.ts <url> -` | Tests de fumée |
| `node "vault de développement/outils/instantane-github.mjs"` | Régénère [[etat-des-stories]] |

Sur ce poste, préfixer selon [[poste-de-developpement]].
