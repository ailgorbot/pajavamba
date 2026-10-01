# PajaVamba — consignes pour les agents

## Comportement de base : le vault d'abord (RI-DOC-10, ADR-0007)

1. **Consulter.** Pour toute question sur le projet (état, lot, code, décision, story, incident, déploiement), lire d'abord [`vault de développement/index.md`](vault%20de%20d%C3%A9veloppement/index.md) puis les pages utiles. Ensuite seulement le code, puis GitHub (issues, PR, projet n° 2).
2. **Trancher.** Le code fait foi. Si le vault le contredit, corriger le vault et le noter dans `log.md` (`contrôle`).
3. **Demander.** Si un doute subsiste ou si la décision revient au mainteneur, l'interroger avec le skill `grill-me` plutôt que de supposer.
4. **Mettre à jour.** Suivre `vault de développement/SCHEMA.md` (opérations ingérer, interroger, contrôler) :
   - à chaque PR fusionnée et à chaque livraison de lot ;
   - à chaque décision (ADR ou choix du mainteneur en conversation) et à chaque incident ;
   - avant un compactage de contexte : dès que la conversation s'allonge, faire le point dans le vault sans attendre. Le crochet `PreCompact` n'ajoute qu'un instantané mécanique au journal, à compléter à la reprise.

## Audit Semgrep avant chaque livraison (RI-SEC-14, ADR-0008)

Avant de pousser du code : `pnpm audit:semgrep` (Docker requis). Trier chaque constat : confirmé → issue « [Semgrep] … » puis correction (avec test) ; faux positif → `// nosemgrep: <règle>` précédé de la justification, consigné dans une issue ; vulnérabilité exploitable → avis de sécurité privé (RI-SEC-12), jamais d'issue publique. Une erreur d'analyse est un constat. Consigner l'audit dans `log.md` du vault.

## Règles du dépôt

- [`docs/regles-immuables.md`](docs/regles-immuables.md) prévaut sur tout le reste.
- Une PR = une story ou un correctif, ≤ 400 lignes hors fichiers générés ; branche `<type>/<n° issue>-<description>` ; Conventional Commits (type en anglais, description en français), commits signés ; modèle de PR entièrement rempli.
- Un agent ne peut ni approuver ni fusionner (RI-REV-06).
- Aucun secret dans le dépôt, le vault, les journaux ou les messages.

## Poste de développement

Contournements propres à ce poste (disque D: défaillant, chemins de Node et pnpm, signature) : voir `vault de développement/exploitation/poste-de-developpement.md`.
