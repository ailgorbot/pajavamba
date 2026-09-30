---
titre: ADR-0005 — Thème du déploiement de recette
public: mainteneurs, designers
statut: acceptée
version_min: 0.4.0
mise_a_jour: 2026-09-30
---

# ADR-0005 — Thème du déploiement de recette

| Élément | Valeur |
|---|---|
| Statut | Acceptée pour la recette (revue par les mainteneurs attendue) |
| Story | [L0-07](https://github.com/ailgorbot/pajavamba/issues/7) |
| Références | RI-DSF-01, RI-DSF-07, RI-DSF-08, C02 |

## Décision

La recette utilise le DSFR (composants, grille, jetons, icônes, thèmes clair et sombre) avec un **thème neutre** : l'en-tête et le pied de page reprennent le gabarit DSFR **sans bloc Marianne ni mention de l'État**, la marque PajaVamba occupant l'emplacement de l'opérateur. L'usage de l'identité de l'État n'a pas été vérifié pour ce déploiement.

La coque est fournie par `packages/ui` (`AppShell`), seul point d'import du DSFR : un déploiement ministériel pourra substituer l'en-tête officiel sans modifier l'application.

## Conséquences

- Liens obligatoires du pied de page présents (accessibilité, mentions légales, données personnelles).
- La CSP autorise les attributs `style` posés par le script du DSFR et les deux balises `<style>` de `color-scheme` par empreinte ; aucun script en ligne.
