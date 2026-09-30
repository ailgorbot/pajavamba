/**
 * Cas d'usage `instance.initialize` : création de l'organisation et de son propriétaire.
 *
 * Couche : basse (identity/fonctionnel). Règles : RG-ORG-001 (au moins un propriétaire),
 * RG-ORG-002, RI-SCR-07 (aucun secret par défaut : le code d'initialisation est généré à
 * l'installation), RI-CNX-02.
 */
import { domainError, err, ok, toEntityId, type DomainError, type DomainEvent, type OrganisationId, type Result, type UseCaseOutput, type UserId } from '@pajavamba/kernel';
import type { Organisation, User } from '../domaine/identity-model.ts';
import { IDENTITY_EVENTS, identityEvent } from '../domaine/identity.events.ts';
import { checkPassword, validateEmail, validateName, validateSlug } from '../domaine/identity.rules.ts';
import { findSystemRole } from '../domaine/roles.catalog.ts';
import type { IdentityDependencies } from '../ports/identity.ports.ts';

/** Entrée de l'initialisation. */
export interface InitializeInstanceInput {
  /** Identifiant réservé par la couche moyenne, qui ouvre le contexte RLS de la nouvelle organisation. */
  readonly organisationId: OrganisationId;
  readonly setupCode: string;
  readonly organisationName: string;
  readonly organisationSlug: string;
  readonly email: string;
  readonly displayName: string;
  readonly password: string;
}

/** Résultat de l'initialisation. */
export interface InitializeInstanceResult {
  readonly organisationId: OrganisationId;
  readonly userId: UserId;
}

const ALREADY_INITIALIZED = domainError('identity.already_initialized', 'conflict', "L'instance est déjà initialisée.");
const INVALID_SETUP_CODE = domainError('identity.invalid_setup_code', 'forbidden', "Le code d'initialisation est incorrect.");

interface ValidatedInput {
  readonly slug: string;
  readonly name: string;
  readonly email: string;
  readonly displayName: string;
}

/**
 * Valide l'ensemble des champs de l'initialisation.
 * @param dependencies dépendances
 * @param input entrée
 * @returns champs normalisés ou première erreur
 */
function validate(dependencies: IdentityDependencies, input: InitializeInstanceInput): Result<ValidatedInput, DomainError> {
  const slug = validateSlug(input.organisationSlug);
  if (!slug.ok) return slug;
  const name = validateName(input.organisationName);
  if (!name.ok) return name;
  const email = validateEmail(input.email);
  if (!email.ok) return email;
  const displayName = validateName(input.displayName);
  if (!displayName.ok) return displayName;
  const password = checkPassword(input.password, dependencies.secrets.isCompromised(input.password));
  if (!password.ok) return password;
  return ok({ slug: slug.value, name: name.value, email: email.value, displayName: displayName.value });
}

/**
 * Événements de l'initialisation.
 * @param organisation organisation créée
 * @param user propriétaire
 * @param assignmentId attribution du rôle `owner`
 * @returns événements
 */
function initializationEvents(organisation: Organisation, user: User, assignmentId: string): DomainEvent[] {
  const permissions = findSystemRole('owner')?.permissions ?? [];
  return [
    identityEvent(IDENTITY_EVENTS.organisationCreated, organisation.id, { slug: organisation.slug }),
    identityEvent(IDENTITY_EVENTS.userProvisioned, user.id, { organisationId: organisation.id, source: 'setup' }),
    identityEvent(IDENTITY_EVENTS.roleAssigned, assignmentId, { userId: user.id, roleKey: 'owner', scopeType: 'organisation', scopeId: organisation.id, effect: 'allow', permissions: [...permissions] }),
  ];
}

/**
 * Initialise l'instance : organisation, propriétaire, appartenance et rôle `owner`.
 * @param dependencies dépendances
 * @param input entrée
 * @returns identifiants créés et événements
 */
export async function initializeInstance(dependencies: IdentityDependencies, input: InitializeInstanceInput): Promise<Result<UseCaseOutput<InitializeInstanceResult>, DomainError>> {
  if ((await dependencies.organisations.count()) > 0) return err(ALREADY_INITIALIZED);
  if (!dependencies.secrets.verifySetupCode(input.setupCode)) return err(INVALID_SETUP_CODE);
  const valid = validate(dependencies, input);
  if (!valid.ok) return valid;
  const organisation: Organisation = { id: input.organisationId, slug: valid.value.slug, name: valid.value.name, status: 'active' };
  const passwordHash = await dependencies.secrets.hashPassword(input.password);
  const user: User = { id: toEntityId(dependencies.ids.next()), email: valid.value.email, displayName: valid.value.displayName, status: 'active', theme: 'system', passwordHash, failedLoginCount: 0, lastFailedLoginAt: null, version: 1 };
  const assignmentId = dependencies.ids.next();
  await dependencies.organisations.insert(organisation);
  await dependencies.users.insert(user);
  await dependencies.organisations.upsertMembership({ organisationId: organisation.id, userId: user.id, orgRole: 'owner', status: 'active' });
  await dependencies.assignments.insert({ id: assignmentId, organisationId: organisation.id, userId: user.id, roleKey: 'owner', scope: { type: 'organisation' }, effect: 'allow', grantedBy: null });
  return ok({ result: { organisationId: organisation.id, userId: user.id }, events: initializationEvents(organisation, user, assignmentId) });
}
