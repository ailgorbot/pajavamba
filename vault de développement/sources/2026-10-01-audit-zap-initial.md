---
type: source
date: 2026-10-01
immuable: oui
---

# Audit DAST OWASP ZAP initial (01/10/2026)

Instantané immuable. Image `ghcr.io/zaproxy/zaproxy` 2.17.0 (empreinte dans `tools/zap/audit-zap.ts`), `zap-baseline.py` (règles passives). Synthèse vivante : [[audit-zap]].

## Pile locale, `main` = `7e34177` (avant corrections)

| Alerte | Risque | URL | Verdict | Suite |
|---|---|---|---|---|
| 90004 Cross-Origin-Embedder-Policy absent | Faible | `/`, `/robots.txt`, `/sitemap.xml`, interface | Confirmé (durcissement) | #278 |
| 10049 Contenu stockable non mis en cache | Info | `/`, `/assets/*`, icônes | Confirmé (`max-age=0` sur les ressources versionnées) | #279 |
| 10109 Application web moderne | Info | `/` | Information d'outillage : passer au spider AJAX (`-j`) | `.zap/regles.tsv` |

Couverture sans `-j` : `/` et fichiers statiques ; avec `-j` : en plus `/initialisation`, `/api/v1/me`, `/api/v1/setup` (≈ 1 min 20). 64 règles passives passées.

## Pendant la correction (pile locale)

| Alerte | Cause | Suite |
|---|---|---|
| 90022 Application Error Disclosure (500 sur `/`) | Régression : `setHeaders` de `@fastify/static` 10 reçoit une réponse Fastify (`reply.header`), pas la réponse Node (`setHeader`) | Corrigée avant livraison ; types vérifiés |
| 120000 Information dans `localStorage` (`scheme`, `scheme-website-config-default`) | Préférence de thème du DSFR, non sensible | `.zap/faux-positifs.tsv` |
| 10049 (trois variantes) | Politique de cache voulue (immuable, revalidé, non stockable pour l'API) | `.zap/regles.tsv` |

Bilan final pile locale : **0 constat**. Tests de fumée : tous passés avec COEP et la nouvelle politique de cache.

## Recette (analyse passive, version déployée)

| Alerte | Risque | Occurrences | Suite |
|---|---|---|---|
| 90004 Cross-Origin-Embedder-Policy absent | Faible | 5 | Couvert par #278, réanalyse après déploiement |
| 10015 Re-examine Cache-control Directives | Info | 5 | Couvert par #279, réanalyse après déploiement |
