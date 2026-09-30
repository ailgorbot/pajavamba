/**
 * Ports requis par les cas d'usage du service identity.
 *
 * Couche : basse (identity/fonctionnel). Règles : RI-ARC-08 (aucune cryptographie ni entrée/sortie
 * dans le cœur : hachage, aléa et TOTP passent par des ports), RI-ARC-10.
 */
import type { AccessPolicy, Clock, IdGenerator, OrganisationId, ProjectId, UserId } from '@pajavamba/kernel';
import type { ApiKey, Membership, Organisation, RoleAssignment, Session, TotpFactor, User } from '../domaine/identity-model.ts';

/** Dépôt des organisations et appartenances. */
export interface OrganisationRepository {
  count(): Promise<number>;
  findById(id: OrganisationId): Promise<Organisation | undefined>;
  insert(organisation: Organisation): Promise<void>;
  findMembership(organisationId: OrganisationId, userId: UserId): Promise<Membership | undefined>;
  firstActiveMembership(userId: UserId): Promise<Membership | undefined>;
  upsertMembership(membership: Membership): Promise<void>;
  listMembers(organisationId: OrganisationId): Promise<readonly { readonly user: User; readonly membership: Membership }[]>;
}

/** Dépôt des utilisateurs (globaux à l'instance). */
export interface UserRepository {
  findById(id: UserId): Promise<User | undefined>;
  findByEmail(email: string): Promise<User | undefined>;
  insert(user: User): Promise<void>;
  update(user: User): Promise<void>;
}

/** Dépôt des sessions. */
export interface SessionRepository {
  insert(session: Session, secretHash: Uint8Array): Promise<void>;
  findBySecretHash(secretHash: Uint8Array): Promise<Session | undefined>;
  findById(id: string): Promise<Session | undefined>;
  update(session: Session): Promise<void>;
  listActiveOf(userId: UserId, now: number): Promise<readonly Session[]>;
  revokeAllOf(userId: UserId, now: number): Promise<number>;
}

/** Dépôt des attributions de rôles. */
export interface AssignmentRepository {
  insert(assignment: RoleAssignment): Promise<void>;
  findById(organisationId: OrganisationId, id: string): Promise<RoleAssignment | undefined>;
  delete(organisationId: OrganisationId, id: string): Promise<void>;
  listForProject(organisationId: OrganisationId, projectId: ProjectId): Promise<readonly RoleAssignment[]>;
  listForUser(organisationId: OrganisationId, userId: UserId): Promise<readonly RoleAssignment[]>;
  countOwners(organisationId: OrganisationId): Promise<number>;
}

/** Dépôt des facteurs MFA et codes de récupération. */
export interface MfaRepository {
  findTotp(userId: UserId): Promise<TotpFactor | undefined>;
  saveTotp(factor: TotpFactor): Promise<void>;
  replaceRecoveryCodes(userId: UserId, hashes: readonly string[]): Promise<void>;
}

/** Dépôt des clés API et des invitations. */
export interface CredentialRepository {
  findActiveKeyOf(userId: UserId): Promise<ApiKey | undefined>;
  findKeyByPublicId(publicId: string): Promise<(ApiKey & { readonly secretHash: Uint8Array }) | undefined>;
  insertKey(key: ApiKey, secretHash: Uint8Array): Promise<void>;
  revokeKey(id: string, now: number): Promise<void>;
  revokeKeysOf(userId: UserId, now: number): Promise<void>;
  touchKey(id: string, now: number): Promise<void>;
  insertInvitation(invitation: { readonly userId: UserId; readonly organisationId: OrganisationId; readonly codeHash: Uint8Array; readonly expiresAt: number }): Promise<void>;
  consumeInvitation(codeHash: Uint8Array, now: number): Promise<{ readonly userId: UserId; readonly organisationId: OrganisationId } | undefined>;
}

/** Secret émis : valeur à remettre une seule fois et empreinte à stocker. */
export interface IssuedSecret {
  readonly value: string;
  readonly hash: Uint8Array;
}

/** Émission et vérification des secrets (aléa sûr, HMAC avec poivre, argon2id, TOTP). */
export interface SecretService {
  hashPassword(password: string): Promise<string>;
  verifyPassword(hash: string, password: string): Promise<boolean>;
  isCompromised(password: string): boolean;
  issueSessionSecret(): IssuedSecret;
  issueCsrfToken(): string;
  issueInvitationCode(): IssuedSecret;
  issueApiKey(): IssuedSecret & { readonly publicId: string };
  hashSecret(value: string): Uint8Array;
  sameHash(left: Uint8Array, right: Uint8Array): boolean;
  issueRecoveryCodes(): Promise<{ readonly codes: readonly string[]; readonly hashes: readonly string[] }>;
  generateTotpSecret(): string;
  totpUri(secret: string, accountLabel: string): string;
  verifyTotp(secret: string, code: string, now: number): boolean;
  verifySetupCode(code: string): boolean;
}

/** Ensemble des dépendances des cas d'usage identity. */
export interface IdentityDependencies {
  readonly organisations: OrganisationRepository;
  readonly users: UserRepository;
  readonly sessions: SessionRepository;
  readonly assignments: AssignmentRepository;
  readonly mfa: MfaRepository;
  readonly credentials: CredentialRepository;
  readonly secrets: SecretService;
  readonly policy: AccessPolicy;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}
