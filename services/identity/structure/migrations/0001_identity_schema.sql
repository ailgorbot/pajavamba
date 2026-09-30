-- Schéma du service identity (§6.5.1) : organisations, utilisateurs, appartenances, attributions,
-- sessions, MFA, clés API, invitations. Règles : RI-DON-01 à RI-DON-03, RI-SCR-03.
CREATE SCHEMA IF NOT EXISTS identity;
COMMENT ON SCHEMA identity IS 'Service identity : identités, sessions, rôles et clés';

DO $$ BEGIN
  CREATE ROLE pv_identity_app NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
GRANT USAGE ON SCHEMA identity TO pv_identity_app;
SELECT pv_ops.create_service_tables('identity', 'pv_identity_app');

CREATE TABLE identity.organisations (
  id uuid NOT NULL,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9-]{3,40}$'),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  status text NOT NULL CHECK (status IN ('active', 'suspended', 'pending_deletion')),
  locale text NOT NULL DEFAULT 'fr-FR',
  time_zone text NOT NULL DEFAULT 'Europe/Paris',
  created_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT pk_organisations PRIMARY KEY (id),
  CONSTRAINT ux_organisations_slug UNIQUE (slug)
);
COMMENT ON TABLE identity.organisations IS 'Organisations (locataires) de l''instance';
COMMENT ON COLUMN identity.organisations.id IS 'Identifiant (UUIDv7) ; classe I';
COMMENT ON COLUMN identity.organisations.slug IS 'Identifiant lisible unique (RG-ORG-002) ; classe P';
COMMENT ON COLUMN identity.organisations.name IS 'Nom affiché ; classe I';
COMMENT ON COLUMN identity.organisations.status IS 'Statut ; classe I';
COMMENT ON COLUMN identity.organisations.locale IS 'Langue par défaut ; classe P';
COMMENT ON COLUMN identity.organisations.time_zone IS 'Fuseau IANA par défaut ; classe P';
COMMENT ON COLUMN identity.organisations.created_at IS 'Date de création ; classe I';
COMMENT ON COLUMN identity.organisations.version IS 'Version d''agrégat ; classe I';

CREATE TABLE identity.users (
  id uuid NOT NULL,
  email citext NOT NULL CHECK (length(email) <= 320),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
  status text NOT NULL CHECK (status IN ('invited', 'active', 'suspended', 'deactivated')),
  locale text NOT NULL DEFAULT 'fr-FR',
  time_zone text NOT NULL DEFAULT 'Europe/Paris',
  theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
  password_hash text,
  failed_login_count integer NOT NULL DEFAULT 0,
  last_failed_login_at timestamptz,
  last_login_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT pk_users PRIMARY KEY (id),
  CONSTRAINT ux_users_email UNIQUE (email)
);
COMMENT ON TABLE identity.users IS 'Utilisateurs, globaux à l''instance ; l''accès passe par les appartenances';
COMMENT ON COLUMN identity.users.id IS 'Identifiant (UUIDv7) ; classe I';
COMMENT ON COLUMN identity.users.email IS 'Adresse électronique ; classe D';
COMMENT ON COLUMN identity.users.display_name IS 'Nom affiché ; classe D ; IA N1 pseudonymisé';
COMMENT ON COLUMN identity.users.status IS 'Statut ; classe I';
COMMENT ON COLUMN identity.users.locale IS 'Langue ; classe P';
COMMENT ON COLUMN identity.users.time_zone IS 'Fuseau IANA ; classe P';
COMMENT ON COLUMN identity.users.theme IS 'Thème d''affichage ; classe P';
COMMENT ON COLUMN identity.users.password_hash IS 'Empreinte argon2id ; classe X';
COMMENT ON COLUMN identity.users.failed_login_count IS 'Échecs de connexion consécutifs (ralentissement) ; classe I';
COMMENT ON COLUMN identity.users.last_failed_login_at IS 'Dernier échec de connexion ; classe D';
COMMENT ON COLUMN identity.users.last_login_at IS 'Dernière connexion ; classe D';
COMMENT ON COLUMN identity.users.deactivated_at IS 'Date de désactivation ; classe I';
COMMENT ON COLUMN identity.users.created_at IS 'Date de création ; classe I';
COMMENT ON COLUMN identity.users.version IS 'Version d''agrégat ; classe I';

CREATE TABLE identity.memberships (
  organisation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  org_role text NOT NULL CHECK (org_role IN ('owner', 'admin', 'auditor', 'member', 'guest')),
  status text NOT NULL CHECK (status IN ('invited', 'active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_memberships PRIMARY KEY (organisation_id, user_id),
  CONSTRAINT fk_memberships_organisation FOREIGN KEY (organisation_id) REFERENCES identity.organisations (id),
  CONSTRAINT fk_memberships_user FOREIGN KEY (user_id) REFERENCES identity.users (id)
);
CREATE INDEX ix_memberships_user ON identity.memberships (user_id);
COMMENT ON TABLE identity.memberships IS 'Appartenances des utilisateurs aux organisations';
COMMENT ON COLUMN identity.memberships.organisation_id IS 'Organisation (RLS) ; classe I';
COMMENT ON COLUMN identity.memberships.user_id IS 'Utilisateur ; classe D';
COMMENT ON COLUMN identity.memberships.org_role IS 'Rôle d''organisation ; classe I';
COMMENT ON COLUMN identity.memberships.status IS 'Statut de l''appartenance ; classe I';
COMMENT ON COLUMN identity.memberships.created_at IS 'Date de création ; classe I';

CREATE TABLE identity.role_assignments (
  organisation_id uuid NOT NULL,
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  role_key text NOT NULL CHECK (length(role_key) BETWEEN 1 AND 60),
  scope_type text NOT NULL CHECK (scope_type IN ('organisation', 'project')),
  scope_id uuid NOT NULL,
  effect text NOT NULL CHECK (effect IN ('allow', 'deny')),
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_role_assignments PRIMARY KEY (organisation_id, id),
  CONSTRAINT fk_role_assignments_membership FOREIGN KEY (organisation_id, user_id) REFERENCES identity.memberships (organisation_id, user_id)
);
CREATE INDEX ix_role_assignments_user ON identity.role_assignments (organisation_id, user_id);
CREATE INDEX ix_role_assignments_scope ON identity.role_assignments (organisation_id, scope_type, scope_id);
COMMENT ON TABLE identity.role_assignments IS 'Attributions de rôles par portée, autorisations ou refus explicites';
COMMENT ON COLUMN identity.role_assignments.organisation_id IS 'Organisation (RLS) ; classe I';
COMMENT ON COLUMN identity.role_assignments.id IS 'Identifiant (UUIDv7) ; classe I';
COMMENT ON COLUMN identity.role_assignments.user_id IS 'Bénéficiaire ; classe D';
COMMENT ON COLUMN identity.role_assignments.role_key IS 'Rôle attribué ; classe P';
COMMENT ON COLUMN identity.role_assignments.scope_type IS 'Type de portée ; classe I';
COMMENT ON COLUMN identity.role_assignments.scope_id IS 'Identifiant de la portée ; classe I';
COMMENT ON COLUMN identity.role_assignments.effect IS 'Autorisation ou refus ; classe I';
COMMENT ON COLUMN identity.role_assignments.granted_by IS 'Auteur de l''attribution ; classe D';
COMMENT ON COLUMN identity.role_assignments.created_at IS 'Date d''attribution ; classe I';

CREATE TABLE identity.sessions (
  id uuid NOT NULL,
  secret_hash bytea NOT NULL,
  user_id uuid NOT NULL,
  current_organisation_id uuid NOT NULL,
  csrf_token text NOT NULL,
  created_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  mfa_verified_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT pk_sessions PRIMARY KEY (id),
  CONSTRAINT ux_sessions_secret_hash UNIQUE (secret_hash),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES identity.users (id)
);
CREATE INDEX ix_sessions_user ON identity.sessions (user_id);
COMMENT ON TABLE identity.sessions IS 'Sessions de l''interface (empreinte du secret uniquement)';
COMMENT ON COLUMN identity.sessions.id IS 'Identifiant (UUIDv7) ; classe I';
COMMENT ON COLUMN identity.sessions.secret_hash IS 'Empreinte HMAC-SHA-256 du secret ; classe X';
COMMENT ON COLUMN identity.sessions.user_id IS 'Utilisateur ; classe D';
COMMENT ON COLUMN identity.sessions.current_organisation_id IS 'Organisation courante ; classe I';
COMMENT ON COLUMN identity.sessions.csrf_token IS 'Jeton CSRF de la session ; classe X';
COMMENT ON COLUMN identity.sessions.created_at IS 'Ouverture ; classe I';
COMMENT ON COLUMN identity.sessions.last_seen_at IS 'Dernière activité ; classe I';
COMMENT ON COLUMN identity.sessions.mfa_verified_at IS 'Dernière vérification MFA ; classe I';
COMMENT ON COLUMN identity.sessions.revoked_at IS 'Révocation ; classe I';

CREATE TABLE identity.totp_factors (
  user_id uuid NOT NULL,
  secret text NOT NULL,
  confirmed boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_totp_factors PRIMARY KEY (user_id),
  CONSTRAINT fk_totp_factors_user FOREIGN KEY (user_id) REFERENCES identity.users (id)
);
COMMENT ON TABLE identity.totp_factors IS 'Facteurs TOTP (RFC 6238)';
COMMENT ON COLUMN identity.totp_factors.user_id IS 'Utilisateur ; classe D';
COMMENT ON COLUMN identity.totp_factors.secret IS 'Secret TOTP chiffré (AES-256-GCM) ; classe X';
COMMENT ON COLUMN identity.totp_factors.confirmed IS 'Enrôlement confirmé ; classe I';
COMMENT ON COLUMN identity.totp_factors.created_at IS 'Date d''enrôlement ; classe I';

CREATE TABLE identity.recovery_codes (
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  used_at timestamptz,
  CONSTRAINT pk_recovery_codes PRIMARY KEY (user_id, code_hash),
  CONSTRAINT fk_recovery_codes_user FOREIGN KEY (user_id) REFERENCES identity.users (id)
);
COMMENT ON TABLE identity.recovery_codes IS 'Codes de récupération MFA à usage unique';
COMMENT ON COLUMN identity.recovery_codes.user_id IS 'Utilisateur ; classe D';
COMMENT ON COLUMN identity.recovery_codes.code_hash IS 'Empreinte argon2id ; classe X';
COMMENT ON COLUMN identity.recovery_codes.used_at IS 'Date d''utilisation ; classe I';

CREATE TABLE identity.api_keys (
  id uuid NOT NULL,
  public_id text NOT NULL CHECK (length(public_id) = 8),
  secret_hash bytea NOT NULL,
  kind text NOT NULL DEFAULT 'personal' CHECK (kind IN ('personal', 'service_account', 'scim')),
  owner_id uuid NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  read_only boolean NOT NULL,
  created_at timestamptz NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT pk_api_keys PRIMARY KEY (id),
  CONSTRAINT ux_api_keys_public_id UNIQUE (public_id),
  CONSTRAINT fk_api_keys_owner FOREIGN KEY (owner_id) REFERENCES identity.users (id)
);
CREATE INDEX ix_api_keys_owner ON identity.api_keys (owner_id);
COMMENT ON TABLE identity.api_keys IS 'Clés API personnelles (empreinte seule, RI-SCR-03)';
COMMENT ON COLUMN identity.api_keys.id IS 'Identifiant (UUIDv7) ; classe I';
COMMENT ON COLUMN identity.api_keys.public_id IS 'Partie publique affichable ; classe I';
COMMENT ON COLUMN identity.api_keys.secret_hash IS 'HMAC-SHA-256 du jeton avec poivre ; classe X';
COMMENT ON COLUMN identity.api_keys.kind IS 'Nature de la clé ; classe I';
COMMENT ON COLUMN identity.api_keys.owner_id IS 'Propriétaire ; classe D';
COMMENT ON COLUMN identity.api_keys.name IS 'Nom donné par le propriétaire ; classe I';
COMMENT ON COLUMN identity.api_keys.read_only IS 'Lecture seule ; classe I';
COMMENT ON COLUMN identity.api_keys.created_at IS 'Création ; classe I';
COMMENT ON COLUMN identity.api_keys.last_used_at IS 'Dernier usage ; classe I';
COMMENT ON COLUMN identity.api_keys.revoked_at IS 'Révocation ; classe I';

CREATE TABLE identity.invitations (
  code_hash bytea NOT NULL,
  user_id uuid NOT NULL,
  organisation_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  CONSTRAINT pk_invitations PRIMARY KEY (code_hash),
  CONSTRAINT fk_invitations_user FOREIGN KEY (user_id) REFERENCES identity.users (id)
);
CREATE INDEX ix_invitations_user ON identity.invitations (user_id);
COMMENT ON TABLE identity.invitations IS 'Invitations à usage unique, valables 72 heures';
COMMENT ON COLUMN identity.invitations.code_hash IS 'Empreinte HMAC du code ; classe X';
COMMENT ON COLUMN identity.invitations.user_id IS 'Utilisateur invité ; classe D';
COMMENT ON COLUMN identity.invitations.organisation_id IS 'Organisation d''accueil ; classe I';
COMMENT ON COLUMN identity.invitations.expires_at IS 'Échéance ; classe I';
COMMENT ON COLUMN identity.invitations.used_at IS 'Utilisation ; classe I';

ALTER TABLE identity.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY p_memberships_organisation ON identity.memberships
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);
ALTER TABLE identity.role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.role_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY p_role_assignments_organisation ON identity.role_assignments
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);

-- Recherche des appartenances actives d'un utilisateur avant que l'organisation soit connue
-- (connexion, clé API) : fonction étroite, exécutée avec les droits du propriétaire du schéma.
CREATE FUNCTION identity.active_memberships_of(p_user_id uuid)
RETURNS TABLE (organisation_id uuid, org_role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = identity, pg_temp AS $$
  SELECT m.organisation_id, m.org_role
  FROM identity.memberships m
  JOIN identity.organisations o ON o.id = m.organisation_id
  WHERE m.user_id = p_user_id AND m.status = 'active' AND o.status = 'active'
  ORDER BY m.created_at
$$;
COMMENT ON FUNCTION identity.active_memberships_of(uuid) IS 'Appartenances actives d''un utilisateur, hors contexte d''organisation';
REVOKE ALL ON FUNCTION identity.active_memberships_of(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identity.active_memberships_of(uuid) TO pv_identity_app;

GRANT SELECT, INSERT, UPDATE ON identity.organisations, identity.users, identity.memberships, identity.sessions, identity.totp_factors, identity.api_keys, identity.invitations TO pv_identity_app;
GRANT SELECT, INSERT, DELETE ON identity.role_assignments, identity.recovery_codes TO pv_identity_app;
