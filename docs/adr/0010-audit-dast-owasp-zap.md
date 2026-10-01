---
titre: ADR-0010 — Audit DAST OWASP ZAP à chaque livraison
public: mainteneurs, développeurs, agents
statut: acceptée
version_min: 0.4.0
mise_a_jour: 2026-10-01
---

# ADR-0010 — Audit DAST OWASP ZAP à chaque livraison

| Élément | Valeur |
|---|---|
| Statut | **Acceptée** le 01/10/2026 par le mainteneur |
| Story | [L0-39](https://github.com/ailgorbot/pajavamba/issues/277) |
| Références | RI-RGS-03, RI-SEC-09, RI-SEC-12, RI-SEC-14, §16.5 ; nouvelle règle RI-SEC-15 |

## Contexte

Les spécifications prévoient un DAST OWASP ZAP sur la recette à chaque release (§16.5, RI-RGS-03), planifié au lot 7 (L7-11). L'audit Semgrep (ADR-0008) ne voit que le code ; les en-têtes, cookies, réponses d'erreur et la configuration réelle (proxy, TLS) ne se vérifient qu'application démarrée. Le premier audit ZAP du 01/10/2026 a relevé l'absence de `Cross-Origin-Embedder-Policy`, une politique de cache à `max-age=0` partout, et a détecté avant livraison une régression (page d'accueil en erreur 500) introduite par la correction du cache.

## Options (cible)

| Option | Conséquence |
|---|---|
| **Pile locale et CI + recette en analyse passive** | Couvre le code et la configuration réelle sans risque pour la recette |
| Pile locale et CI seulement | Proxy et TLS de Coolify jamais vérifiés |
| Analyse active aussi sur la recette | Données de test et charge sur la recette |
| Reporter au lot 7 | Faiblesses découvertes tard |

## Décision

1. `pnpm audit:zap` (`tools/zap/audit-zap.ts`, image `ghcr.io/zaproxy/zaproxy` 2.17.0 épinglée par empreinte) : démarre une pile locale éphémère, l'explore (spider classique et AJAX) avec les règles passives, l'arrête et supprime ses volumes. Obligatoire avant toute poussée qui modifie du code exécuté (`apps/`, `services/`, `packages/`, `deploy/`).
2. CI : analyse passive bloquante sur la pile éphémère du job « Pile conteneurisée » à chaque PR ; analyse **active** chaque lundi et à la demande sur une pile éphémère dédiée (`security.yml`).
3. Recette : analyse **passive uniquement** (`--cible <adresse>`) à chaque livraison de lot ; le script refuse `--actif` hors d'un réseau Docker éphémère.
4. Triage : constat confirmé → issue « [ZAP] … » puis correction ; faux positif → `.zap/regles.tsv` (règle entière, justifiée) ou `.zap/faux-positifs.tsv` (paramètre précis, justifié) ; vulnérabilité exploitable → avis de sécurité privé (RI-SEC-12).
5. L'adresse de la recette n'est jamais versionnée ; les rapports (`.zap/rapports/`) restent locaux.

## Conséquences

- Nouvelle règle **RI-SEC-15** ; `docs/regles-immuables.md` passe en version 1.3.0.
- Avance une partie de L7-11 ; l'analyse des parcours authentifiés et de l'API suit dans #280.
- Docker est nécessaire sur le poste de l'auteur.
