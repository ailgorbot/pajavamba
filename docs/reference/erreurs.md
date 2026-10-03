---
titre: Référence des erreurs
public: développeurs, exploitants
statut: généré
version_min: 0.4.0
---

# Référence des erreurs

> Document **généré** par `tools/reference/generate-catalogs.ts` depuis les erreurs métier (`domainError`) et les problèmes HTTP déclarés dans le code (RI-DOC-03). Ne pas modifier à la main.

Toutes les erreurs sont renvoyées au format RFC 9457 (`application/problem+json`), avec le code stable ci-dessous. Nombre de codes : 69.

| Code | Statut HTTP | Message ou titre | Origine |
|---|---|---|---|
| `access.forbidden` | 403 | Vous n'avez pas les droits nécessaires pour cette action. | kernel |
| `access.not_found` | 404 | La ressource demandée n'existe pas ou n'est pas accessible. | kernel, portfolio, query, workflow, workitem |
| `api.csrf_invalid` | 403 | Jeton CSRF invalide | api-gateway |
| `api.token_in_url` | 400 | Jeton dans l’URL | api-gateway |
| `identity.already_initialized` | 409 | L'instance est déjà initialisée. | identity |
| `identity.api_key_not_found` | 404 | Vous n'avez pas de clé API active. | identity |
| `identity.assignment_not_found` | 404 | Attribution introuvable. | identity |
| `identity.concurrent_update` | 409 | Modification concurrente | identity |
| `identity.email_taken` | 409 | Un utilisateur existe déjà avec cette adresse. | identity |
| `identity.invalid_credentials` | 403 | Identifiants incorrects. | identity |
| `identity.invalid_email` | 422 | L'adresse électronique est invalide. | identity |
| `identity.invalid_invitation` | 404 | Ce lien d'invitation est invalide ou expiré. | identity |
| `identity.invalid_mfa_code` | 422 | Le code saisi est incorrect ou expiré. | identity |
| `identity.invalid_name` | 422 | Le nom doit contenir entre 1 et 120 caractères. | identity |
| `identity.invalid_setup_code` | 403 | Le code d'initialisation est incorrect. | identity |
| `identity.invalid_slug` | 422 | L'identifiant d'organisation doit contenir 3 à 40 caractères parmi a-z, 0-9 et « - ». | identity |
| `identity.last_owner` | 409 | L'organisation doit conserver au moins un propriétaire actif. | identity |
| `identity.login_throttled` | 409 | Trop de tentatives. Patientez quelques secondes avant de réessayer. | identity |
| `identity.mfa_already_enrolled` | 409 | Une application d’authentification est déjà enrôlée. | identity |
| `identity.mfa_not_started` | 409 | Démarrez d'abord l'enrôlement. | identity |
| `identity.mfa_required` | 422 | Saisissez le code à usage unique de votre application d'authentification. | identity |
| `identity.not_a_member` | 422 | Cet utilisateur n'appartient pas à l'organisation. | identity |
| `identity.not_found` | 404 | Ressource introuvable | identity |
| `identity.password_compromised` | 422 | Ce mot de passe figure dans une liste de mots de passe compromis. Choisissez-en un autre. | identity |
| `identity.password_too_short` | 422 | Le mot de passe doit contenir au moins 12 caractères. | identity |
| `identity.self_deactivation` | 409 | Vous ne pouvez pas désactiver votre propre compte. | identity |
| `identity.session_not_found` | 404 | Session introuvable. | identity |
| `identity.unknown_role` | 422 | Ce rôle n'existe pas pour cette portée. | identity |
| `identity.user_not_found` | 404 | Utilisateur introuvable. | identity |
| `ops.idempotency_key_reused` | 422 | Clé d'idempotence déjà utilisée | ops |
| `ops.internal_error` | 500 | Erreur interne | ops |
| `ops.not_found` | 404 | Ressource introuvable | ops, pv-app |
| `ops.unauthenticated` | 401 | Authentification requise | ops |
| `ops.validation_failed` | 422 | Données invalides | ops |
| `ops.version_mismatch` | 412 | Version périmée | ops |
| `portfolio.concurrent_update` | 412 | Version périmée | portfolio |
| `portfolio.configuration_pending` | 409 | La configuration du modèle méthodologique (types et workflows publiés) n'est pas encore prête. Réessayez dans quelques instants. | portfolio |
| `portfolio.invalid_allocation` | 422 | L'allocation doit être comprise entre 1 et 100 %. | portfolio |
| `portfolio.invalid_key` | 422 | La clé doit commencer par une majuscule et contenir 2 à 10 caractères parmi A-Z et 0-9. | portfolio |
| `portfolio.invalid_name` | 422 | Le nom doit contenir entre 1 et 120 caractères. | portfolio |
| `portfolio.invalid_team_key` | 422 | La clé d'équipe doit commencer par une majuscule et contenir 2 à 6 caractères parmi A-Z et 0-9. | portfolio |
| `portfolio.invalid_working_days` | 422 | Les jours travaillés doivent être compris entre 1 (lundi) et 7 (dimanche). | portfolio |
| `portfolio.key_taken` | 409 | Cette clé de projet est déjà utilisée dans votre organisation. | portfolio |
| `portfolio.project_read_only` | 409 | Ce projet est clôturé, archivé ou en suppression programmée : il est en lecture seule. | portfolio |
| `portfolio.reopen_window_expired` | 409 | Le délai de réouverture de 90 jours est dépassé. | portfolio |
| `portfolio.team_key_taken` | 409 | Cette clé d'équipe est déjà utilisée. | portfolio |
| `portfolio.team_member_not_found` | 404 | Cette personne n'est pas membre de l'équipe. | portfolio |
| `portfolio.team_not_found` | 404 | Équipe introuvable dans ce projet. | portfolio |
| `portfolio.text_required` | 422 | Ce texte est obligatoire. | portfolio |
| `portfolio.text_too_long` | 422 | Le texte ne doit pas dépasser 10 000 caractères. | portfolio |
| `request.precondition_required` | 428 | En-tête If-Match requis | api-gateway, ops |
| `workflow.invalid_key` | 422 | La clé du workflow doit être au format a-z, 0-9, « _ » (2 à 41 caractères). | workflow |
| `workflow.project_read_only` | 409 | Ce projet est en lecture seule. | workflow |
| `workflow.unknown_pack` | 422 | Modèle méthodologique inconnu. | workflow |
| `workflow.version_immutable` | 409 | Seule une version brouillon peut être publiée ; une version publiée est immuable. | workflow |
| `workitem.approval_required` | 409 | Cette transition exige une validation humaine, disponible avec le service de validation (lot 5). | workitem |
| `workitem.concurrent_update` | 412 | Version périmée | workitem |
| `workitem.hierarchy_cycle` | 409 | Ce rattachement créerait un cycle dans la hiérarchie. | workitem |
| `workitem.hierarchy_too_deep` | 409 | La hiérarchie ne peut pas dépasser 7 niveaux. | workitem |
| `workitem.invalid_comment` | 422 | Le commentaire doit contenir entre 1 et 20 000 caractères. | workitem |
| `workitem.invalid_estimate` | 422 | L'estimation doit être comprise entre 0 et 9 999. | workitem |
| `workitem.invalid_title` | 422 | Le titre doit contenir entre 1 et 255 caractères. | workitem |
| `workitem.not_found` | 404 | Cet élément n'existe pas ou n'est pas accessible. | workitem |
| `workitem.parent_not_found` | 422 | Le parent indiqué est introuvable dans ce projet. | workitem |
| `workitem.project_read_only` | 409 | Ce projet est clôturé, archivé ou en suppression programmée : il est en lecture seule. | workitem |
| `workitem.rank_target_not_found` | 422 | L'élément de référence du classement est introuvable. | workitem |
| `workitem.unknown_type` | 422 | Ce type d'élément n'existe pas dans le projet. | workitem |
| `workitem.version_mismatch` | 412 | L'élément a été modifié entre-temps. Rechargez-le puis réessayez. | workitem |
| `workitem.workflow_not_published` | 409 | La version de workflow de cet élément est introuvable. | workitem |
