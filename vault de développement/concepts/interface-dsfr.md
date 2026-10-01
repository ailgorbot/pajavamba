---
type: concept
mise_a_jour: 2026-10-01
sources: [packages/ui, apps/web, ADR-0005, packages/ops/src/http-server.ts]
---

# Interface et DSFR

- `@codegouvfr/react-dsfr` importé **uniquement** via [[ui]] (`AppShell`, thème) ; thème **neutre** sans Marianne ni mention de l'État (ADR-0005).
- React 19, Vite 8, TanStack Router et Query ([[web]]) ; l'interface relit l'état serveur (pas de temps réel au MVP).
- CSP : pas de script en ligne ; `style-src` avec deux empreintes SHA-256 (balises `<style>` de `color-scheme` du DSFR) et `style-src-attr 'unsafe-inline'` (attributs posés par le script du DSFR) — écart E8 d'ADR-0006.
- En-tête : la liste de liens doit porter `fr-header__menu-links`, sinon erreurs `HeaderLinks` du DSFR.
- Accessibilité : board utilisable au clavier, pages légales (accessibilité, mentions, données personnelles) au pied de page.
