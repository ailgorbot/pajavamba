---
titre: ADR-0009 — Adoption progressive de Prettier
public: développeurs, agents
statut: acceptée
version_min: 0.4.0
mise_a_jour: 2026-10-01
---

# ADR-0009 — Adoption progressive de Prettier

| Élément | Valeur |
|---|---|
| Statut | **Acceptée** le 01/10/2026 par le mainteneur |
| Story | [L0-13](https://github.com/ailgorbot/pajavamba/issues/13) |
| Références | §19.2 (outils de qualité), RI-COD-03 (fonctions de 30 lignes au plus), RI-REV-02 |

## Contexte

Les spécifications prévoient Prettier, mais le code du MVP a été écrit sans lui, avec des lignes longues. Mesure du 01/10/2026 : un reformatage complet touche 85 fichiers à 200 caractères (+2 752 / −541 lignes) et fait dépasser 30 lignes à 56 fonctions ; à 120 caractères, 118 fichiers et 113 fonctions.

## Options

| Option | Conséquence |
|---|---|
| **Adoption progressive, largeur 200** | Seuls les fichiers modifiés par une PR doivent être formatés ; fonctions découpées au passage |
| Reformatage complet à 200 | Une PR mécanique puis plusieurs PR de découpage avant de reprendre les stories |
| Reformatage complet à 120 | Chantier le plus lourd (113 fonctions) |
| Prettier hors TypeScript | Écart aux spécifications |

## Décision

1. Configuration `.prettierrc.json` : guillemets simples, largeur 200, virgules finales, fins de ligne LF.
2. En CI (job « Qualité », PR uniquement), `tools/ci/format-modifies.ts` vérifie le formatage des fichiers de code (`.ts`, `.tsx`, `.mjs`, `.cjs`, `.js`) ajoutés ou modifiés par la PR.
3. Avant de pousser : `pnpm format:modifies` formate ces fichiers ; si une fonction dépasse alors 30 lignes, elle est découpée dans la même PR.
4. Markdown, JSON et YAML restent contrôlés par markdownlint et les outils existants.

## Conséquences

- Le dépôt converge vers un formatage uniforme au fil des stories, sans grande PR de reformatage.
- Une PR qui touche un fichier ancien porte aussi son formatage : le relecteur distingue l'intention du formatage grâce au commit séparé quand c'est utile.
