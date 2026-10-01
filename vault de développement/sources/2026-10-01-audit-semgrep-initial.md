---
type: source
date: 2026-10-01
immuable: oui
---

# Audit Semgrep initial (01/10/2026)

Instantané immuable du premier audit complet du code déjà livré (`main` = `b258a5f`, après #263), image `semgrep/semgrep:1.178.0`, règles du projet + `p/typescript`, `p/javascript`, `p/nodejs`, `p/react`, `p/owasp-top-ten`, `p/sql-injection`, `p/secrets`, `p/dockerfile`, `p/github-actions` (160 règles, 234 fichiers). Synthèse vivante : [[audit-semgrep]].

## Règles du projet (CI de #264)

| Constat | Emplacement | Suite |
|---|---|---|
| `pv-sql-concatenation` | `deploy/units/pv-app/src/migrate.ts:41` (`GRANT ${SERVICE_ROLES…}`) | Annoté, justifié (identifiants non paramétrables) |
| `pv-sql-concatenation` | `services/query/.../projection.consumer.ts:115` (`DELETE FROM ${table}`) | Trois requêtes littérales |
| `pv-sql-concatenation` (règle complétée aux appels `query<T>`) | 9 dépôts : `WHERE ${column} = $1`, `ORDER BY ${…}` | Requêtes littérales choisies par clé (`SELECT_BY`) |

## Jeux officiels

| Règle | Gravité | Emplacement | Verdict | Issue |
|---|---|---|---|---|
| `gcm-no-tag-length` | ERROR | `packages/ops/src/secrets.ts:204` | Confirmé (durcissement) | #265 → PR #268 |
| `pnpm-minimum-release-age` | MEDIUM | `pnpm-workspace.yaml` | Confirmé | #266 → PR #269 |
| `pnpm-block-exotic-sub-dependencies` | MEDIUM | `pnpm-workspace.yaml` | Confirmé | #266 → PR #269 |
| `pnpm-trust-policy` | MEDIUM | `pnpm-workspace.yaml` | Confirmé | #266 → PR #269 |
| `npm-missing-minimum-release-age` | MEDIUM | `.npmrc` | Confirmé | #266 → PR #269 |
| `express-res-sendfile` | WARNING | `deploy/units/pv-app/src/main.ts:72` | Faux positif (`'index.html'` constant) | #267 → PR #270 |
| Erreur d'analyse YAML | — | `.github/ISSUE_TEMPLATE/anomalie.yml:18` | « É » en tête de valeur sans guillemets | #267 → PR #270 |
| Analyse partielle | — | `tools/ci/check-pr-body.ts:15` | Expression régulière mal lue | #267 → PR #270 |
