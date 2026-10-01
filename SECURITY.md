# Politique de sécurité

## Signaler une vulnérabilité

**Ne signalez jamais une vulnérabilité par une issue publique** (RI-SEC-12).

Utilisez le signalement privé de GitHub : onglet **Security → Report a vulnerability** du dépôt [ailgorbot/pajavamba](https://github.com/ailgorbot/pajavamba/security/advisories/new).

Indiquez si possible :

- la version ou le commit concerné ;
- le composant (service, interface, déploiement) ;
- les étapes de reproduction et l'impact estimé ;
- vos coordonnées pour le suivi.

N'incluez aucune donnée personnelle réelle ni aucun secret réel (jeton `pvb_…`, mot de passe) dans le signalement.

## Délais de traitement

| Étape | Délai cible |
|---|---|
| Accusé de réception | 3 jours ouvrés |
| Première évaluation (gravité, périmètre) | 10 jours ouvrés |
| Correctif des vulnérabilités critiques ou élevées | 30 jours |
| Publication de l'avis de sécurité | À la mise à disposition du correctif |

## Versions prises en charge

| Version | Correctifs de sécurité |
|---|---|
| 0.4.x (MVP, recette) | Oui |
| < 0.4 | Non |

La politique de support complète (§22.1 des spécifications) s'appliquera à partir de la version 1.0.

## Bonnes pratiques attendues des contributeurs

- Aucun secret dans le code, la configuration versionnée, les journaux ou les exemples (RI-SCR-01, RI-DOC-09).
- Toute nouvelle dépendance est justifiée (usage, maintenance, licence, sécurité) (RI-COD-10).
- Les zones protégées listées dans [`CODEOWNERS`](.github/CODEOWNERS) exigent la relecture d'un mainteneur (RI-REV-03).
