---
titre: Référence des actions de l’API
public: développeurs, intégrateurs
statut: généré
version_min: 0.4.0
---

# Référence des actions

> Document **généré** par `tools/reference/generate-actions-reference.ts` depuis le registre d’actions (RI-DOC-03). Ne pas modifier à la main.

Nombre d’actions : 56.

| Route | Action | Accès | Niveau de risque | Description | Règles |
|---|---|---|---|---|---|
| `GET /api/v1/audit` | `audit.list` | `audit:read` | R3 — administration (interface + MFA récente) | Consulte le journal d'audit de l'organisation (entrées les plus récentes). | RG-IAM-003 |
| `GET /api/v1/audit/verification` | `audit.verify` | `audit:read` | R3 — administration (interface + MFA récente) | Vérifie l'intégrité de la chaîne d'audit. | — |
| `POST /api/v1/invitations/accept` | `invitation.accept` | publique | R1 — écriture réversible | Accepte une invitation en choisissant son mot de passe. | — |
| `GET /api/v1/me` | `me.get` | utilisateur authentifié | R0 — lecture | Retourne mon profil, mon organisation et mes permissions. | — |
| `PATCH /api/v1/me` | `me.update` | utilisateur authentifié | R1 — écriture réversible | Modifie mon nom affiché ou mon thème. | — |
| `DELETE /api/v1/me/api-key` | `api_key.revoke` | `api_key:manage_own` | R3 — administration (interface + MFA récente) | Révoque ma clé API personnelle. | RG-IAM-003 |
| `POST /api/v1/me/api-key` | `api_key.create` | `api_key:manage_own` | R3 — administration (interface + MFA récente) | Crée ou régénère ma clé API personnelle (affichée une seule fois). | RG-IAM-003 |
| `POST /api/v1/me/mfa/totp` | `mfa.totp_start` | utilisateur authentifié | R1 — écriture réversible | Démarre l'enrôlement d'une application d'authentification (TOTP). | — |
| `POST /api/v1/me/mfa/totp/confirm` | `mfa.totp_confirm` | utilisateur authentifié | R1 — écriture réversible | Confirme l'enrôlement TOTP et remet les codes de récupération. | — |
| `POST /api/v1/me/mfa/verify` | `mfa.verify` | utilisateur authentifié | R1 — écriture réversible | Vérifie un code MFA pour la session courante (MFA récente). | RG-IAM-003 |
| `GET /api/v1/me/sessions` | `session.list` | utilisateur authentifié | R0 — lecture | Liste mes sessions actives. | — |
| `DELETE /api/v1/me/sessions/:sessionId` | `session.revoke` | utilisateur authentifié | R1 — écriture réversible | Révoque l'une de mes sessions. | RG-IAM-005 |
| `GET /api/v1/projects` | `project.list` | `project:read` | R0 — lecture | Liste les projets accessibles (archivés masqués par défaut). | — |
| `POST /api/v1/projects` | `project.create` | `project:create` | R1 — écriture réversible | Crée un projet en brouillon. | RG-PRJ-001, RG-PRJ-002 |
| `GET /api/v1/projects/:projectRef` | `project.get` | `project:read` | R0 — lecture | Lit un projet et les points bloquants de sa clôture. | RG-PRJ-005 |
| `PATCH /api/v1/projects/:projectRef` | `project.update` | `project:update` | R1 — écriture réversible | Modifie les informations d'un projet (la clé est immuable). | RG-PRJ-001, RG-PRJ-004 |
| `POST /api/v1/projects/:projectRef/actions/activate` | `project.activate` | `project:activate` | R1 — écriture réversible | Active un projet en brouillon. | RG-PRJ-003, RG-PRJ-004, RG-PRJ-005, RG-PRJ-006, RG-PRJ-007 |
| `POST /api/v1/projects/:projectRef/actions/archive` | `project.archive` | `project:archive` | R2 — écriture sensible | Archive un projet clôturé. | RG-PRJ-003, RG-PRJ-004, RG-PRJ-005, RG-PRJ-006, RG-PRJ-007 |
| `POST /api/v1/projects/:projectRef/actions/cancel-deletion` | `project.cancel_deletion` | `project:delete` | R3 — administration (interface + MFA récente) | Annule une suppression programmée. | RG-PRJ-003, RG-PRJ-004, RG-PRJ-005, RG-PRJ-006, RG-PRJ-007 |
| `POST /api/v1/projects/:projectRef/actions/close` | `project.close` | `project:close` | R2 — écriture sensible | Clôture un projet (bilan obligatoire, aucune clôture forcée). | RG-PRJ-003, RG-PRJ-004, RG-PRJ-005, RG-PRJ-006, RG-PRJ-007 |
| `POST /api/v1/projects/:projectRef/actions/reopen` | `project.reopen` | `project:reopen` | R2 — écriture sensible | Rouvre un projet clôturé depuis moins de 90 jours. | RG-PRJ-003, RG-PRJ-004, RG-PRJ-005, RG-PRJ-006, RG-PRJ-007 |
| `POST /api/v1/projects/:projectRef/actions/request-deletion` | `project.request_deletion` | `project:delete` | R3 — administration (interface + MFA récente) | Programme la suppression (30 jours ; 7 jours pour un brouillon). | RG-PRJ-003, RG-PRJ-004, RG-PRJ-005, RG-PRJ-006, RG-PRJ-007 |
| `POST /api/v1/projects/:projectRef/actions/unarchive` | `project.unarchive` | `project:unarchive` | R3 — administration (interface + MFA récente) | Désarchive un projet. | RG-PRJ-003, RG-PRJ-004, RG-PRJ-005, RG-PRJ-006, RG-PRJ-007 |
| `GET /api/v1/projects/:projectRef/activity` | `activity.list` | `log:read_functional` | R0 — lecture | Journal d'activité fonctionnel du projet. | — |
| `GET /api/v1/projects/:projectRef/backlog` | `backlog.get` | `work_item:read` | R0 — lecture | Backlog ordonné du projet (filtres : type, texte, éléments terminés). | RG-WI-007 |
| `GET /api/v1/projects/:projectRef/board` | `board.get` | `work_item:read` | R0 — lecture | Board du projet : colonnes par état du workflow, limites WIP signalées. | RG-WF-004, RG-WI-007 |
| `GET /api/v1/projects/:projectRef/members` | `project_member.list` | `project:read` | R0 — lecture | Liste les attributions de rôles d'un projet. | — |
| `GET /api/v1/projects/:projectRef/teams` | `team.list` | `team:read` | R0 — lecture | Liste les équipes d'un projet et leurs membres. | — |
| `POST /api/v1/projects/:projectRef/teams` | `team.create` | `team:manage` | R1 — écriture réversible | Crée une équipe rattachée au projet. | RG-PRJ-004 |
| `POST /api/v1/projects/:projectRef/teams/:teamId/members` | `team.add_member` | `team:manage_members` | R3 — administration (interface + MFA récente) | Ajoute ou modifie un membre d’équipe. | RG-IA-002 |
| `DELETE /api/v1/projects/:projectRef/teams/:teamId/members/:userId` | `team.remove_member` | `team:manage_members` | R3 — administration (interface + MFA récente) | Retire un membre d’équipe. | — |
| `GET /api/v1/projects/:projectRef/work-item-types` | `work_item_type.list` | `work_item:read` | R0 — lecture | Liste les types d'éléments et la hiérarchie du projet. | RG-WI-002 |
| `POST /api/v1/projects/:projectRef/work-items` | `work_item.create` | `work_item:create` | R1 — écriture réversible | Crée un élément de travail. | RG-WI-001, RG-WI-002, RG-WI-003, RG-WI-005 |
| `DELETE /api/v1/projects/:projectRef/work-items/:itemKey` | `work_item.delete` | `work_item:delete` | R2 — écriture sensible | Place un élément dans la corbeille (30 jours). | RG-WI-008 |
| `GET /api/v1/projects/:projectRef/work-items/:itemKey` | `work_item.get` | `work_item:read` | R0 — lecture | Lit le détail d'un élément : transitions possibles, sous-éléments, commentaires, historique. | RG-WI-007 |
| `PATCH /api/v1/projects/:projectRef/work-items/:itemKey` | `work_item.update` | `work_item:update` | R1 — écriture réversible | Modifie un élément (If-Match obligatoire). | RG-WI-002, RG-WI-003 |
| `POST /api/v1/projects/:projectRef/work-items/:itemKey/actions/assign` | `work_item.assign` | `work_item:assign` | R1 — écriture réversible | Assigne ou désassigne un élément. | — |
| `POST /api/v1/projects/:projectRef/work-items/:itemKey/actions/rank` | `work_item.rank` | `work_item:rank` | R1 — écriture réversible | Ordonne un élément dans le backlog. | — |
| `POST /api/v1/projects/:projectRef/work-items/:itemKey/actions/restore` | `work_item.restore` | `work_item:delete` | R2 — écriture sensible | Restaure un élément de la corbeille. | RG-WI-008 |
| `POST /api/v1/projects/:projectRef/work-items/:itemKey/actions/transition` | `work_item.transition` | `work_item:transition` | R1 — écriture réversible | Fait passer un élément dans un nouvel état selon son workflow. | RG-WI-005, RG-WF-004, RG-WF-005 |
| `POST /api/v1/projects/:projectRef/work-items/:itemKey/comments` | `work_item.comment` | `work_item:comment` | R1 — écriture réversible | Ajoute un commentaire à un élément. | — |
| `POST /api/v1/projects/:projectRef/workflow-versions/:versionId/actions/publish` | `workflow.publish` | `workflow:configure` | R2 — écriture sensible | Publie une version brouillon, qui devient immuable. | RG-WF-001 |
| `GET /api/v1/projects/:projectRef/workflows` | `workflow.list` | `project:read` | R0 — lecture | Liste les workflows d'un projet et leurs versions. | RG-WF-001 |
| `POST /api/v1/projects/:projectRef/workflows` | `workflow.draft` | `workflow:configure` | R2 — écriture sensible | Crée une version brouillon d'un workflow. | RG-WF-002 |
| `POST /api/v1/role-assignments` | `role.assign` | `role:manage` | R3 — administration (interface + MFA récente) | Attribue ou refuse explicitement un rôle (organisation ou projet). | RG-IAM-002 |
| `DELETE /api/v1/role-assignments/:assignmentId` | `role.revoke` | `role:manage` | R3 — administration (interface + MFA récente) | Retire une attribution de rôle. | RG-ORG-001 |
| `GET /api/v1/roles` | `role.list` | `organisation:read` | R0 — lecture | Liste les rôles disponibles et leurs permissions. | — |
| `GET /api/v1/search` | `search.items` | `work_item:read` | R0 — lecture | Recherche plein texte (français) dans les projets accessibles. | RG-WI-007 |
| `POST /api/v1/sessions` | `session.open` | publique | R1 — écriture réversible | Ouvre une session avec un compte local. | — |
| `DELETE /api/v1/sessions/current` | `session.close` | utilisateur authentifié | R1 — écriture réversible | Ferme la session courante (déconnexion). | — |
| `GET /api/v1/setup` | `instance.status` | publique | R0 — lecture | Indique si l'instance est initialisée. | — |
| `POST /api/v1/setup` | `instance.initialize` | publique | R1 — écriture réversible | Initialise l'instance : organisation et propriétaire. | RG-ORG-001, RG-ORG-002 |
| `GET /api/v1/users` | `user.list` | `organisation:read` | R0 — lecture | Liste les membres de l'organisation. | — |
| `POST /api/v1/users` | `user.invite` | `user:manage` | R3 — administration (interface + MFA récente) | Invite un utilisateur ; le code d'invitation est affiché une seule fois. | — |
| `POST /api/v1/users/:userId/actions/deactivate` | `user.deactivate` | `user:manage` | R3 — administration (interface + MFA récente) | Désactive un utilisateur et révoque ses accès. | RG-IAM-005, RG-ORG-001 |
| `POST /api/v1/users/:userId/actions/reactivate` | `user.reactivate` | `user:manage` | R3 — administration (interface + MFA récente) | Réactive un utilisateur. | RG-IAM-005, RG-ORG-001 |

## Catalogue des permissions

| Permission | Niveau | Description |
|---|---|---|
| `organisation:read` | R0 | Lire les informations de l'organisation |
| `organisation:configure` | R3 | Modifier les paramètres de l'organisation |
| `user:manage` | R3 | Inviter, désactiver, réactiver des utilisateurs |
| `role:manage` | R3 | Attribuer, retirer, refuser des rôles |
| `audit:read` | R3 | Lire le journal d'audit |
| `log:read_functional` | R0 | Lire le journal d'activité |
| `api_key:manage_own` | R3 | Créer, régénérer, révoquer sa clé |
| `project:read` | R0 | Lire un projet |
| `project:create` | R1 | Créer un projet |
| `project:update` | R1 | Modifier les informations d'un projet |
| `project:configure` | R2 | Types, hiérarchie, champs, boards |
| `project:manage_members` | R3 | Membres et rôles du projet |
| `project:activate` | R1 | Activer un projet |
| `project:close` | R2 | Clôturer un projet |
| `project:reopen` | R2 | Rouvrir un projet |
| `project:archive` | R2 | Archiver un projet |
| `project:unarchive` | R3 | Désarchiver un projet |
| `project:delete` | R3 | Supprimer un projet |
| `team:read` | R0 | Lire les équipes |
| `team:manage` | R1 | Gérer les équipes |
| `team:manage_members` | R3 | Gérer les appartenances aux équipes |
| `work_item:read` | R0 | Lire les éléments |
| `work_item:read_restricted` | R0 | Lire les éléments confidentiels |
| `work_item:create` | R1 | Créer un élément |
| `work_item:update` | R1 | Modifier un élément |
| `work_item:transition` | R1 | Changer l'état d'un élément |
| `work_item:assign` | R1 | Assigner un élément |
| `work_item:comment` | R1 | Commenter un élément |
| `work_item:rank` | R1 | Ordonner le backlog |
| `work_item:delete` | R2 | Supprimer un élément (corbeille) |
| `workflow:configure` | R2 | Créer et publier des workflows |
| `report:read` | R0 | Lire les rapports |
