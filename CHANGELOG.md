# Journal des modifications

## 0.4.0 — MVP (non publiée, en recette)

### Ajouts

- Socle : noyau typé, contrats (permissions, registre d'actions, événements), couche OPS (configuration, journal catalogué, erreurs RFC 9457, migrateur, secrets, chaîne d'écriture avec outbox, idempotence et simulation).
- Identité : initialisation de l'instance, comptes locaux argon2id, sessions et CSRF, ralentissement des échecs, TOTP et codes de récupération, invitations, désactivation avec révocation immédiate, rôles par portée et refus explicites, clé API personnelle.
- Autorisation : décision locale (RBAC, refus explicites prioritaires, actions R3 réservées à l'interface avec MFA récente).
- Projets : création en brouillon, activation, assistant de clôture, réouverture, archivage, suppression programmée et purge ; équipes et membres.
- Workflows : packs Scrum, Kanban, Scrumban, Personnalisé ; versions publiées immuables.
- Éléments : création, hiérarchie contrôlée, transitions, assignation, rang, commentaires, historique, corbeille, confidentialité.
- Lecture : backlog, board, recherche plein texte française, journal d'activité.
- Audit : journal chaîné par organisation, vérifiable.
- Interface DSFR (thème neutre) : connexion, initialisation, projets, backlog, board au clavier, détail d'élément, profil, administration, audit, pages légales.
- Livraison : image OCI non root en lecture seule, composition avec génération des secrets, tests de fumée, CI.
