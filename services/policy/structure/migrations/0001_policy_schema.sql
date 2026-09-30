-- Schéma du service policy : projection locale des attributions pour l'évaluation sans saut
-- synchrone (§4.6, RI-SRV-03) ; alimentée par les événements d'identity (RI-SRV-01).
CREATE SCHEMA IF NOT EXISTS policy;
COMMENT ON SCHEMA policy IS 'Service policy : projection des attributions et décisions d''autorisation';

DO $$ BEGIN
  CREATE ROLE pv_policy_app NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
GRANT USAGE ON SCHEMA policy TO pv_policy_app;

CREATE TABLE policy.assignments (
  organisation_id uuid NOT NULL,
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  role_key text NOT NULL CHECK (length(role_key) BETWEEN 1 AND 60),
  scope_type text NOT NULL CHECK (scope_type IN ('organisation', 'project')),
  scope_id uuid NOT NULL,
  effect text NOT NULL CHECK (effect IN ('allow', 'deny')),
  permissions text[] NOT NULL,
  CONSTRAINT pk_assignments PRIMARY KEY (organisation_id, id)
);
CREATE INDEX ix_assignments_user ON policy.assignments (organisation_id, user_id);
COMMENT ON TABLE policy.assignments IS 'Projection des attributions de rôles (source : identity)';
COMMENT ON COLUMN policy.assignments.organisation_id IS 'Organisation propriétaire (RLS) ; classe I';
COMMENT ON COLUMN policy.assignments.id IS 'Identifiant de l''attribution dans identity ; classe I';
COMMENT ON COLUMN policy.assignments.user_id IS 'Bénéficiaire ; classe D';
COMMENT ON COLUMN policy.assignments.role_key IS 'Clé technique du rôle ; classe P';
COMMENT ON COLUMN policy.assignments.scope_type IS 'Portée : organisation ou projet ; classe I';
COMMENT ON COLUMN policy.assignments.scope_id IS 'Identifiant de la portée ; classe I';
COMMENT ON COLUMN policy.assignments.effect IS 'Autorisation ou refus explicite ; classe I';
COMMENT ON COLUMN policy.assignments.permissions IS 'Permissions du rôle au moment de l''attribution ; classe P';

CREATE TABLE policy.inactive_users (
  user_id uuid NOT NULL,
  CONSTRAINT pk_inactive_users PRIMARY KEY (user_id)
);
COMMENT ON TABLE policy.inactive_users IS 'Utilisateurs désactivés : aucune permission effective (RG-IAM-005)';
COMMENT ON COLUMN policy.inactive_users.user_id IS 'Utilisateur désactivé ; classe D';

SELECT pv_ops.create_service_tables('policy', 'pv_policy_app');

ALTER TABLE policy.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy.assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY p_assignments_organisation ON policy.assignments
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON policy.assignments, policy.inactive_users TO pv_policy_app;
