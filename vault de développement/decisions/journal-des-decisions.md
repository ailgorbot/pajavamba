---
type: décision
mise_a_jour: 2026-10-01
sources: [[2026-10-01-decisions-du-mainteneur]]
---

# Journal des décisions (hors ADR)

Choix pris en conversation, avec leur conséquence durable. Source brute : [[2026-10-01-decisions-du-mainteneur]].

| Date | Décision | Par | Conséquence pour la suite |
|---|---|---|---|
| 29/09 | Commit d'amorçage non signé | Mainteneur | Seul commit non signé de `main` ; tous les suivants sont signés |
| 30/09 | Signature SSH via l'agent Windows | Mainteneur | Après un redémarrage, le mainteneur doit refaire `ssh-add` ; voir [[poste-de-developpement]] |
| 30/09 | Licence Apache-2.0 | Mainteneur | ADR-0001 ; dépendances compatibles |
| 30/09 | Une PR par lot pour le MVP | Mainteneur | Exception au MVP ; ensuite une PR par story |
| 30/09 | Autorisation en TypeScript, pas de Rust/Cedar au MVP | Agent (ADR-0006 proposée) | À valider ; L1-03 à L1-05 au backlog |
| 30/09 | Déplacer le projet de D: vers `G:\Claude\PajaVamba` | Mainteneur | Ne plus jamais écrire sur D: |
| 30/09 | Ne pas traiter les sujets hors périmètre signalés (jetons d'autres applications, révocation de la clé Coolify) | Mainteneur | Ne plus les mentionner |
| 30/09 | Recette validée (« Le MVP est OK ») | Mainteneur | 70 stories passées à Done |
| 01/10 | Reprendre story par story les éléments partiels, à partir de L0-08 | Mainteneur (« continue ») | Ordre suivi : L0-08, L0-09, puis vault |
| 01/10 | Vault de développement, règle immuable et comportement de base | Mainteneur | ADR-0007, RI-DOC-10, `CLAUDE.md`, skill grill-me, crochets |
| 01/10 | Chaque PR de story embarque sa mise à jour du vault | Agent | Pas de PR séparée pour le vault, sauf refonte |
| 01/10 | Audit Semgrep complet avant chaque livraison, issues et corrections ; règle immuable | Mainteneur | ADR-0008, RI-SEC-14, `pnpm audit:semgrep`, [[audit-semgrep]] |
| 01/10 | Constat AES-GCM classé « durcissement » (issue publique) et non « vulnérabilité » (avis privé) | Agent | Exploitation conditionnée à un accès en écriture à la base ; à revoir avec le mainteneur si désaccord |
| 01/10 | Prettier adopté progressivement, largeur 200 : seuls les fichiers modifiés par une PR sont vérifiés et formatés (question posée avec grill-me) | Mainteneur | ADR-0009 ; `pnpm format:modifies` avant poussée ; fonctions découpées au passage |
| 01/10 | Infrastructure de recette (adresse, identifiants Coolify) hors du dépôt public | Agent | Notes dans `vault de développement/local/` (non versionné) |

Questions ouvertes pour le mainteneur (à poser avec grill-me le moment venu) : validation d'ADR-0006 ; activation des rulesets et de la sécurité du dépôt (L0-01, L0-02) ; création de la GitHub App des agents (L0-10).
