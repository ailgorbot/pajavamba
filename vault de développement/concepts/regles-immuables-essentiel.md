---
type: concept
mise_a_jour: 2026-10-01
sources: [docs/regles-immuables.md (1.3.0)]
---

# Règles immuables : l'essentiel en pratique

Le document fait foi (`docs/regles-immuables.md`) ; il ne se modifie que par ADR acceptée + approbation CODEOWNERS + nouvelle version.

| Thème | Règles qui reviennent tout le temps |
|---|---|
| Couches | RI-ARC-01 à 03, RI-ARC-08, RI-SRV-01 à 03 : voir [[architecture-en-couches]] |
| Code | RI-COD-02 (ni `any`, `enum`, `namespace`, `export default`), RI-COD-03 (seuils), RI-COD-09 (SQL paramétré), RI-COD-10 (dépendance justifiée, compatible Apache-2.0) |
| Nommage | RI-NOM-01 : identifiants en anglais, commentaires, docs, messages et tests en français |
| Revue | RI-REV-02 (≤ 400 lignes, une story), RI-REV-03 (CODEOWNERS sur zones protégées), RI-REV-05 (modèle de PR), RI-REV-06 (un agent ne fusionne pas) |
| Documentation | RI-DOC-01 (`docs/` source unique), RI-DOC-02 (doc dans la même PR), RI-DOC-03 (référence générée), RI-DOC-04 (ADR), RI-DOC-10 (vault d'abord) |
| Sécurité | RI-SEC-12 (failles en privé), RI-SEC-14 (audit Semgrep avant chaque livraison, [[audit-semgrep]]), RI-SEC-15 (audit ZAP, [[audit-zap]]), RI-SCR-01 (aucun secret versionné), RI-DOC-09 (aucune donnée réelle) |
| Git | RI-GIT-03 (actions épinglées, permissions minimales, pas de `pull_request_target`), RI-GIT-05 (LICENSE), RI-NOM-09 (Conventional Commits) |
| Données | RI-DON-04 (migrations vers l'avant), RI-AUD-01 (audit dans la transaction) |

Zones protégées : `packages/ops`, `packages/kernel`, `packages/contracts`, `packages/ui`, migrations, sécurité, `.github/`, `docs/specifications`, `docs/adr`, `docs/regles-immuables.md`.
