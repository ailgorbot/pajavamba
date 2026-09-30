---
titre: Prise en main de PajaVamba
public: utilisateurs, administrateurs
statut: en vigueur
version_min: 0.4.0
mise_a_jour: 2026-09-30
---

# Prise en main de PajaVamba

## 1. Initialiser l'instance (propriétaire)

À la première visite, PajaVamba propose l'écran **Initialiser l'instance**. Saisissez le code d'initialisation fourni par l'exploitant, le nom et l'identifiant de votre organisation, puis créez votre compte propriétaire (mot de passe de 12 caractères minimum, les mots de passe courants sont refusés).

## 2. Se connecter et sécuriser son compte

1. Connectez-vous avec votre adresse et votre mot de passe. Après plusieurs échecs, les tentatives sont ralenties quelques secondes (jamais bloquées).
2. Dans **Mon profil › Authentification à plusieurs facteurs**, activez une application d'authentification (TOTP) et conservez les codes de récupération affichés une seule fois.
3. Les actions sensibles — gestion des accès, clé API, désarchivage et suppression de projet — exigent une **vérification MFA de moins de 15 minutes** : utilisez « Vérifier maintenant » dans Mon profil.

## 3. Inviter des personnes (administrateur)

**Administration › Inviter une personne** crée un compte invité et affiche un lien d'invitation valable 72 heures, à transmettre à la personne. Elle choisit son mot de passe via ce lien. La désactivation d'un compte révoque immédiatement ses sessions et sa clé API.

## 4. Créer et piloter un projet

1. **Projets › Créer un projet** : clé (immuable, ex. `PAJA`), nom, modèle méthodologique (Scrum, Kanban, Scrumban, Personnalisé). Le projet naît en **brouillon** ; ses types d'éléments et workflows sont préparés automatiquement.
2. **Activer le projet** dès que la configuration est « Prête ».
3. Onglet **Membres et rôles** : attribuez les rôles de projet (Administrateur de projet, Product Owner, Scrum Master, Contributeur, Lecteur).
4. Onglet **Équipes** : créez les équipes rattachées au projet.

## 5. Backlog, board et éléments

- **Backlog** : ajoutez des éléments (type, titre, parent) ; ordonnez-les avec « Monter » / « Descendre » ; filtrez par texte.
- **Board** : une colonne par état du workflow. Déplacez une carte par glisser-déposer ou, au clavier, avec la liste **Déplacer vers…** de la carte. Un dépassement de limite de travail en cours est signalé par un texte.
- **Détail d'un élément** : modifiez les champs (une modification concurrente est détectée et refusée), changez d'état, assignez, commentez, consultez l'historique, mettez à la corbeille (restaurable 30 jours).
- **Recherche** : recherche plein texte en français dans tous les projets accessibles.

## 6. Clôturer, archiver, supprimer

L'onglet **Vue d'ensemble** d'un projet actif présente l'**assistant de clôture** : tant qu'un élément n'est ni terminé ni annulé, la clôture est refusée (aucune clôture forcée). Un projet clôturé est en lecture seule ; il peut être rouvert pendant 90 jours, puis archivé. La suppression d'un projet archivé est programmée avec un délai de grâce de 30 jours (7 jours pour un brouillon), annulable jusqu'à l'échéance.

## 7. Accès programmatique

Dans **Mon profil › Clé API personnelle**, créez une clé (affichée une seule fois) et utilisez-la dans l'en-tête `Authorization: Bearer …`. La clé n'encode aucun droit : vos rôles actuels s'appliquent à chaque appel. Référence : [actions de l'API](../reference/actions.md).
