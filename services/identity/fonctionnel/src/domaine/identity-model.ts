/**
 * Types du domaine identity : organisations, utilisateurs, appartenances, sessions, attributions, clés.
 *
 * Couche : basse (identity/fonctionnel). Référence : §6.5.1 des spécifications.
 */
import type { OrganisationId, ProjectId, UserId } from '@pajavamba/kernel';

/** Statut d'une organisation. */
export type OrganisationStatus = 'active' | 'suspended' | 'pending_deletion';

/** Organisation (locataire). */
export interface Organisation {
  readonly id: OrganisationId;
  readonly slug: string;
  readonly name: string;
  readonly status: OrganisationStatus;
}

/** Statut d'un utilisateur. */
export type UserStatus = 'invited' | 'active' | 'suspended' | 'deactivated';

/** Thème d'affichage préféré. */
export type Theme = 'system' | 'light' | 'dark';

/** Utilisateur de l'instance. */
export interface User {
  readonly id: UserId;
  readonly email: string;
  readonly displayName: string;
  readonly status: UserStatus;
  readonly theme: Theme;
  readonly passwordHash: string | null;
  readonly failedLoginCount: number;
  readonly lastFailedLoginAt: number | null;
  readonly version: number;
}

/** Rôle d'organisation porté par l'appartenance. */
export type OrganisationRole = 'owner' | 'admin' | 'auditor' | 'member';

/** Appartenance d'un utilisateur à une organisation. */
export interface Membership {
  readonly organisationId: OrganisationId;
  readonly userId: UserId;
  readonly orgRole: OrganisationRole;
  readonly status: 'invited' | 'active' | 'suspended';
}

/** Portée d'une attribution de rôle. */
export type AssignmentScope = { readonly type: 'organisation' } | { readonly type: 'project'; readonly projectId: ProjectId };

/** Attribution d'un rôle à un utilisateur, autorisation ou refus explicite. */
export interface RoleAssignment {
  readonly id: string;
  readonly organisationId: OrganisationId;
  readonly userId: UserId;
  readonly roleKey: string;
  readonly scope: AssignmentScope;
  readonly effect: 'allow' | 'deny';
  readonly grantedBy: UserId | null;
}

/** Session d'interface. */
export interface Session {
  readonly id: string;
  readonly userId: UserId;
  readonly organisationId: OrganisationId;
  readonly createdAt: number;
  readonly lastSeenAt: number;
  readonly mfaVerifiedAt: number | null;
  readonly csrfToken: string;
  readonly revokedAt: number | null;
}

/** Facteur TOTP d'un utilisateur. */
export interface TotpFactor {
  readonly userId: UserId;
  readonly secret: string;
  readonly confirmed: boolean;
}

/** Clé API personnelle (métadonnées ; seule l'empreinte du secret est stockée). */
export interface ApiKey {
  readonly id: string;
  readonly userId: UserId;
  readonly publicId: string;
  readonly name: string;
  readonly readOnly: boolean;
  readonly createdAt: number;
  readonly lastUsedAt: number | null;
  readonly revokedAt: number | null;
}
