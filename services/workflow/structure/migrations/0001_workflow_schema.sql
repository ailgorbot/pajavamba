-- Schéma du service workflow (§6.5.4) : workflows, versions immuables une fois publiées,
-- projection des projets. Règles : RG-WF-001 (immutabilité garantie aussi en base), RI-DON-01 à 03.
CREATE SCHEMA IF NOT EXISTS workflow;
COMMENT ON SCHEMA workflow IS 'Service workflow : workflows versionnés et packs méthodologiques';

DO $$ BEGIN
  CREATE ROLE pv_workflow_app NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
GRANT USAGE ON SCHEMA workflow TO pv_workflow_app;
SELECT pv_ops.create_service_tables('workflow', 'pv_workflow_app');

CREATE TABLE workflow.projects (
  organisation_id uuid NOT NULL,
  id uuid NOT NULL,
  key text NOT NULL,
  status text NOT NULL,
  pack_key text NOT NULL,
  CONSTRAINT pk_projects PRIMARY KEY (organisation_id, id),
  CONSTRAINT ux_projects_key UNIQUE (organisation_id, key)
);
COMMENT ON TABLE workflow.projects IS 'Projection des projets (source : portfolio)';
COMMENT ON COLUMN workflow.projects.organisation_id IS 'Organisation (RLS) ; classe I';
COMMENT ON COLUMN workflow.projects.id IS 'Projet ; classe I';
COMMENT ON COLUMN workflow.projects.key IS 'Clé du projet ; classe I';
COMMENT ON COLUMN workflow.projects.status IS 'Statut du cycle de vie ; classe I';
COMMENT ON COLUMN workflow.projects.pack_key IS 'Modèle méthodologique ; classe P';

CREATE TABLE workflow.workflows (
  organisation_id uuid NOT NULL,
  id uuid NOT NULL,
  project_id uuid NOT NULL,
  key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_workflows PRIMARY KEY (organisation_id, id),
  CONSTRAINT ux_workflows_key UNIQUE (organisation_id, project_id, key),
  CONSTRAINT fk_workflows_project FOREIGN KEY (organisation_id, project_id) REFERENCES workflow.projects (organisation_id, id) ON DELETE CASCADE
);
CREATE INDEX ix_workflows_project ON workflow.workflows (organisation_id, project_id);
COMMENT ON TABLE workflow.workflows IS 'Workflows d''un projet';
COMMENT ON COLUMN workflow.workflows.organisation_id IS 'Organisation (RLS) ; classe I';
COMMENT ON COLUMN workflow.workflows.id IS 'Identifiant (UUIDv7) ; classe I';
COMMENT ON COLUMN workflow.workflows.project_id IS 'Projet ; classe I';
COMMENT ON COLUMN workflow.workflows.key IS 'Clé technique ; classe P';
COMMENT ON COLUMN workflow.workflows.name IS 'Libellé ; classe P';
COMMENT ON COLUMN workflow.workflows.created_at IS 'Date de création ; classe I';

CREATE TABLE workflow.workflow_versions (
  organisation_id uuid NOT NULL,
  id uuid NOT NULL,
  workflow_id uuid NOT NULL,
  number integer NOT NULL CHECK (number >= 1),
  status text NOT NULL CHECK (status IN ('draft', 'published', 'retired')),
  definition jsonb NOT NULL,
  published_at timestamptz,
  CONSTRAINT pk_workflow_versions PRIMARY KEY (organisation_id, id),
  CONSTRAINT ux_workflow_versions_number UNIQUE (organisation_id, workflow_id, number),
  CONSTRAINT fk_workflow_versions_workflow FOREIGN KEY (organisation_id, workflow_id) REFERENCES workflow.workflows (organisation_id, id) ON DELETE CASCADE
);
CREATE INDEX ix_workflow_versions_workflow ON workflow.workflow_versions (organisation_id, workflow_id);
COMMENT ON TABLE workflow.workflow_versions IS 'Versions de workflow : brouillon, publiée (immuable), retirée';
COMMENT ON COLUMN workflow.workflow_versions.organisation_id IS 'Organisation (RLS) ; classe I';
COMMENT ON COLUMN workflow.workflow_versions.id IS 'Identifiant (UUIDv7) ; classe I';
COMMENT ON COLUMN workflow.workflow_versions.workflow_id IS 'Workflow ; classe I';
COMMENT ON COLUMN workflow.workflow_versions.number IS 'Numéro de version ; classe P';
COMMENT ON COLUMN workflow.workflow_versions.status IS 'Statut ; classe P';
COMMENT ON COLUMN workflow.workflow_versions.definition IS 'États et transitions (langage déclaratif validé) ; classe P';
COMMENT ON COLUMN workflow.workflow_versions.published_at IS 'Date de publication ; classe I';

-- RG-WF-001 : une version publiée n'est jamais modifiée (seul le retrait est admis).
CREATE FUNCTION workflow.forbid_published_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'published' AND (NEW.definition <> OLD.definition OR NEW.status NOT IN ('published', 'retired')) THEN
    RAISE EXCEPTION 'version de workflow publiée immuable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tr_workflow_versions_immutable BEFORE UPDATE ON workflow.workflow_versions
  FOR EACH ROW EXECUTE FUNCTION workflow.forbid_published_change();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects', 'workflows', 'workflow_versions'] LOOP
    EXECUTE format('ALTER TABLE workflow.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE workflow.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY p_%s_organisation ON workflow.%I USING (organisation_id = nullif(current_setting(''app.organisation_id'', true), '''')::uuid)', t, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON workflow.projects, workflow.workflows, workflow.workflow_versions TO pv_workflow_app;
