-- Schéma du service audit (§6.5.8) : journal chaîné en ajout seul.
-- Règles : RI-AUD-02 (lecture seule, sans suppression avant échéance), RI-AUD-04, RI-LOG-10.
CREATE SCHEMA IF NOT EXISTS audit;
COMMENT ON SCHEMA audit IS 'Service audit : journal d''audit chaîné et vérifiable';

DO $$ BEGIN
  CREATE ROLE pv_audit_app NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
GRANT USAGE ON SCHEMA audit TO pv_audit_app;
SELECT pv_ops.create_service_tables('audit', 'pv_audit_app');

CREATE TABLE audit.audit_entries (
  organisation_id uuid NOT NULL,
  seq bigint NOT NULL,
  event_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL,
  actor_type text NOT NULL,
  actor_id uuid,
  channel text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  decision text NOT NULL CHECK (decision IN ('allow', 'deny')),
  correlation_id text NOT NULL,
  changed_fields text[] NOT NULL,
  prev_hash text NOT NULL,
  hash text NOT NULL,
  CONSTRAINT pk_audit_entries PRIMARY KEY (organisation_id, seq),
  CONSTRAINT ux_audit_entries_event UNIQUE (event_id)
);
COMMENT ON TABLE audit.audit_entries IS 'Journal d''audit chaîné par organisation (ajout seul)';
COMMENT ON COLUMN audit.audit_entries.organisation_id IS 'Organisation (RLS) ; classe I';
COMMENT ON COLUMN audit.audit_entries.seq IS 'Rang dans la chaîne de l''organisation ; classe I';
COMMENT ON COLUMN audit.audit_entries.event_id IS 'Entrée d''outbox d''origine (idempotence) ; classe I';
COMMENT ON COLUMN audit.audit_entries.occurred_at IS 'Date ; classe I';
COMMENT ON COLUMN audit.audit_entries.actor_type IS 'Nature de l''acteur ; classe P';
COMMENT ON COLUMN audit.audit_entries.actor_id IS 'Acteur (pseudonymisable) ; classe D';
COMMENT ON COLUMN audit.audit_entries.channel IS 'Canal ; classe P';
COMMENT ON COLUMN audit.audit_entries.action IS 'Action du registre ; classe P';
COMMENT ON COLUMN audit.audit_entries.resource_type IS 'Type de ressource ; classe P';
COMMENT ON COLUMN audit.audit_entries.resource_id IS 'Ressource ; classe I';
COMMENT ON COLUMN audit.audit_entries.decision IS 'Décision d''autorisation ; classe P';
COMMENT ON COLUMN audit.audit_entries.correlation_id IS 'Corrélation ; classe I';
COMMENT ON COLUMN audit.audit_entries.changed_fields IS 'Noms des champs modifiés, jamais les valeurs (RI-AUD-04) ; classe P';
COMMENT ON COLUMN audit.audit_entries.prev_hash IS 'Empreinte de l''entrée précédente ; classe I';
COMMENT ON COLUMN audit.audit_entries.hash IS 'Empreinte de l''entrée ; classe I';

ALTER TABLE audit.audit_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.audit_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY p_audit_entries_organisation ON audit.audit_entries
  USING (organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid);

-- Ajout seul : ni mise à jour ni suppression par le rôle d'exécution.
GRANT SELECT, INSERT ON audit.audit_entries TO pv_audit_app;
