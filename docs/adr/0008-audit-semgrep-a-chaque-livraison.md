---
titre: ADR-0008 — Audit Semgrep à chaque livraison de code
public: mainteneurs, développeurs, agents
statut: acceptée
version_min: 0.4.0
mise_a_jour: 2026-10-01
---

# ADR-0008 — Audit Semgrep à chaque livraison de code

| Élément | Valeur |
|---|---|
| Statut | **Acceptée** le 01/10/2026 à la demande du mainteneur |
| Story | [L0-38](https://github.com/ailgorbot/pajavamba/issues/271) |
| Références | RI-SEC-09, RI-SEC-12, RI-COD-14, H10, §16.5 ; nouvelle règle RI-SEC-14 |

## Contexte

`security.yml` (L0-16) bloque les PR sur les règles Semgrep du projet. Le premier audit avec les jeux de règles officiels (01/10/2026) a pourtant relevé six constats et deux erreurs d'analyse sur du code déjà fusionné (#265, #266, #267). Les jeux officiels évoluent : un contrôle ponctuel ne suffit pas.

## Options

| Option | Avantages | Inconvénients |
|---|---|---|
| Règles du projet seules en CI | Déterministe | Ignore les faiblesses génériques (cryptographie, chaîne d'approvisionnement, frameworks) |
| Jeux officiels bloquants en CI uniquement | Automatique | Une nouvelle règle publiée peut bloquer une PR sans rapport ; constats découverts trop tard |
| **Audit complet par l'auteur avant chaque livraison, constats tracés en issues** | Constats traités au plus tôt, tracés, justifiés | Exige Docker sur le poste |

## Décision

1. Avant chaque poussée de code vers GitHub, l'auteur (personne ou agent) exécute `node tools/semgrep/audit-semgrep.ts` : image Semgrep épinglée, règles du projet et jeux officiels (TypeScript, JavaScript, Node.js, React, OWASP Top 10, injection SQL, secrets, Dockerfile, GitHub Actions).
2. Chaque constat est trié :
   - **confirmé** : une issue « [Semgrep] … » (étiquettes, jalon, projet n° 2) puis sa correction, avec un test quand le code s'y prête ;
   - **faux positif** : annotation `nosemgrep: <règle>` précédée de sa justification, consignée dans une issue ;
   - **vulnérabilité exploitable** : avis de sécurité privé (RI-SEC-12), jamais d'issue publique.
3. Une erreur d'analyse est traitée comme un constat : un fichier non analysé est un angle mort.
4. La livraison n'a lieu qu'avec un bilan à zéro, hors constats déjà suivis par une issue ouverte et corrigés dans une PR en cours.
5. Les règles du projet restent bloquantes en CI (`security.yml`) ; l'ajout des jeux officiels en CI planifiée suivra.

## Conséquences

- Nouvelle règle **RI-SEC-14** ; `docs/regles-immuables.md` passe en version 1.2.0.
- `CLAUDE.md` et le vault (`concepts/audit-semgrep.md`) décrivent la procédure ; chaque audit est consigné dans le journal du vault.
- Le premier audit a donné #265 (AES-GCM), #266 (chaîne d'approvisionnement) et #267 (faux positif, erreurs d'analyse).
