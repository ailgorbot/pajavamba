---
type: synthèse
mise_a_jour: 2026-10-03
sources: [CHANGELOG.md, docs/adr/, projet GitHub n° 2, historique Git de main, PR ouvertes]
---

# État du projet

## En une phrase

Le **MVP 0.4.0** (lots 0 à 3) est en recette sur Coolify et validé ; le socle de qualité et de sécurité est en place (Semgrep, ZAP, gitleaks, couches, traçabilité, publication), et l'on termine les stories du lot 0 et la dette de tests avant le lot 4.

## Ce qui existe sur `main` (`1701a44`, 03/10/2026)

- Produit utilisable de bout en bout : voir [[lot-00-socle]], [[lot-01-identite-acces]], [[lot-02-projets-equipes]], [[lot-03-elements-workflows]].
- Contrôles en CI : types, tests, lint et seuils, couches (dependency-cruiser), Prettier progressif, référence des actions, gitleaks, cspell, markdownlint, titre et modèle de PR, Semgrep (règles du projet, officiels chaque lundi), ZAP passif sur pile éphémère (actif chaque lundi), dépendances. Voir [[processus-github]], [[audit-semgrep]], [[audit-zap]].
- Règles immuables 1.3.0 (RI-DOC-10 vault, RI-SEC-14 Semgrep, RI-SEC-15 ZAP) ; ADR-0001 à 0010 ([[registre-des-adr]]).
- Publication : `release.yml` (image GHCR signée, SBOM, provenance) et documentation en ligne en HTML (Jekyll) sur <https://ailgorbot.github.io/pajavamba/>.

## PR ouvertes, en attente du mainteneur (03/10/2026)

| PR | Contenu | Remarque |
|---|---|---|
| #292, #293, #294 | L0-23 : client HTTP résilient, idempotence 24 h et 428 du catalogue, limitation de débit | Fusionner dans l'ordre |
| #295, #296 | L0-27 : références générées (erreurs, journal, configuration) et matrice de traçabilité | #296 est construite sur #295 |
| #298 à #301 | #297 : tests des règles RG-* (portfolio, workitem, workflow, identity) → 21 règles sur 24 testées | Après #296 : régénérer `docs/reference/tracabilite.md` sur ces branches |
| #302, #303 | L0-35 : front-matter obligatoire, liens (lychee) | Le lien vers le tableau du projet (privé, 404) est exclu en attendant une décision |

## Travail suspendu et pourquoi

| Sujet | Blocage | Reprise |
|---|---|---|
| VitePress (L0-35) | `minimumReleaseAge` : `bare-fs` 4.8.2 verrouillé, publié le 25/09 | À partir du 03/10 vers 19 h 25 ; VitePress 2.0.0-alpha.20 (choix du mainteneur) |
| Audits locaux Semgrep et ZAP, pnpm, tests | Docker de nouveau opérationnel le 03/10 (images à retélécharger), mais **Node.js absent** : il était installé sur le disque D: défaillant | Réinstaller Node.js 24 sur C: ou G: (mainteneur) ; d'ici là, audits et contrôles dans la CI sur la branche avant d'ouvrir la PR |
| Règles RG-PRJ-002, RG-WI-009, RG-IA-002 | Cas d'usage à tester avec davantage de dépendances simulées | Suite de #297 |

## Prochaines étapes proposées

1. Après fusion des PR : régénérer la matrice de traçabilité, puis VitePress, validation Mermaid, versionnement du site et accessibilité (fin de L0-35).
2. Stories du lot 0 restantes : L0-32 (superviseur), L0-34 (livraison automatique et tag), et celles qui dépendent du mainteneur : L0-01 (rulesets), L0-02 (sécurité du dépôt), L0-10 (GitHub App).
3. Stories partielles des lots 1 à 3 (L1-10, L1-19, L3-12, L3-14, documentation L1-27, L2-20, L3-33), puis lot 4 ([[lots-04-a-15]]).

## Décisions attendues du mainteneur

Valider ADR-0006 ; rendre public le tableau du projet n° 2 (ou retirer le lien) ; créer l'environnement `release` avec approbateur et la variable `RELEASE_PLEASE_ACTIF` ; supprimer ou non la pile locale `pvtest`. Voir [[journal-des-decisions]].

## Points d'attention

- Une PR = une story, ≤ 400 lignes ; un agent ne fusionne jamais. Indexer les fichiers nommément, `set -o pipefail` avant de chaîner les contrôles.
- Fichiers contenant des antislashs (TOML, expressions régulières) : les écrire avec l'outil d'écriture, jamais via le shell.
- Poste : [[poste-de-developpement]] ; leçons : [[lecons-apprises]].
