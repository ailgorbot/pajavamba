-- Schéma du service query (§6.5.8) : vues de lecture consolidées, recherche plein texte française,
-- journal d'activité fonctionnel. Règles : RI-SRV-07, RI-DON-01 à 03, §5.11.
CREATE SCHEMA IF NOT EXISTS query;
COMMENT ON SCHEMA query IS 'Service query : vues de lecture, recherche et journal d''activité';

DO $$ BEGIN
  CREATE ROLE pv_query_app NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
GRANT USAGE ON SCHEMA query TO pv_query_app;
SELECT pv_ops.create_service_tables('query', 'pv_query_app');

CREATE TABLE query.projects (
  organisation_id uuid NOT NULL,
  id uuid NOT NULL,
  key text NOT NULL,
  name text NOT NULL,
  status text NOT NULL,
  CONSTRAINT pk_projects PRIMARY KEY (organisation_id, id),
  CONSTRAINT ux_projects_key UNIQUE (organisation_id, key)
);
COMMENT ON TABLE query.projects IS 'Vue des projets (source : portfolio)';
COMMENT ON COLUMN query.projects.organisation_id IS 'Organisation (RLS) ; classe I';
COMMENT ON COLUMN query.projects.id IS 'Projet ; classe I';
COMMENT ON COLUMN query.projects.key IS 'Clé ; classe I';
COMMENT ON COLUMN query.projects.name IS 'Nom ; classe I';
COMMENT ON COLUMN query.projects.status IS 'Statut ; classe I';

CREATE TABLE query.workflow_states (
  organisation_id uuid NOT NULL,
  project_id uuid NOT NULL,
  version_id uuid NOT NULL,
  workflow_key text NOT NULL,
  version_number integer NOT NULL,
  key text NOT NULL,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('todo', 'in_progress', 'done')),
  position smallint NOT NULL,
  wip_limit integer,
  CONSTRAINT pk_workflow_states PRIMARY KEY (organisation_id, version_id, key)
);
CREATE INDEX ix_workflow_states_project ON query.workflow_states (organisation_id, project_id, workflow_key, version_number DESC);
COMMENT ON TABLE query.workflow_states IS 'États des versions de workflow publiées (source : workflow)';
COMMENT ON COLUMN query.workflow_states.organisation_id IS 'Organisation (RLS) ; classe I';
COMMENT ON COLUMN query.workflow_states.project_id IS 'Projet ; classe I';
COMMENT ON COLUMN query.workflow_states.version_id IS 'Version de workflow ; classe I';
COMMENT ON COLUMN query.workflow_states.workflow_key IS 'Clé du workflow ; classe P';
COMMENT ON COLUMN query.workflow_states.version_number IS 'Numéro de version ; classe P';
COMMENT ON COLUMN query.workflow_states.key IS 'Clé de l''état ; classe P';
COMMENT ON COLUMN query.workflow_states.name IS 'Libellé de l''état ; classe P';
COMMENT ON COLUMN query.workflow_states.category IS 'Catégorie ; classe P';
COMMENT ON COLUMN query.workflow_states.position IS 'Ordre d''affichage ; classe P';
COMMENT ON COLUMN query.workflow_states.wip_limit IS 'Limite de travail en cours ; classe P';

CREATE TABLE query.work_item_views (
  organisation_id uuid NOT NULL,
  id uuid NOT NULL,
  project_id uuid NOT NULL,
  key text NOT NULL,
  number bigint NOT NULL,
  type_key text NOT NULL,
  title text NOT NULL,
  state_key text NOT NULL,
  state_category text NOT NULL,
  workflow_version_id uuid NOT NULL,
  priority text NOT NULL,
  parent_id uuid,
  assignee_id uuid,
  estimate numeric(8, 2),
  rank text NOT NULL COLLATE "C",
  confidentiality text NOT NULL,
  deleted boolean NOT NULL,
  aggregate_version integer NOT NULL,
  tsv tsvector NOT NULL,
  CONSTRAINT pk_work_item_views PRIMARY KEY (organisation_id, id)
);
CREATE INDEX ix_work_item_views_project_rank ON query.work_item_views (organisation_id, project_id, rank) WHERE NOT deleted;
CREATE INDEX ix_work_item_views_tsv ON query.work_item_views USING gin (tsv);
CREATE INDEX ix_work_item_views_title_trgm ON query.work_item_views USING gin (title gin_trgm_ops);
COMMENT ON TABLE query.work_item_views IS 'Vue des éléments pour backlog, board et recherche';
COMMENT ON COLUMN query.work_item_views.organisation_id IS 'Organisation (RLS) ; classe I';
COMMENT ON COLUMN query.work_item_views.id IS 'Élément ; classe I';
COMMENT ON COLUMN query.work_item_views.project_id IS 'Projet ; classe I';
COMMENT ON COLUMN query.work_item_views.key IS 'Clé ; classe I';
COMMENT ON COLUMN query.work_item_views.number IS 'Numéro ; classe I';
COMMENT ON COLUMN query.work_item_views.type_key IS 'Type ; classe I';
COMMENT ON COLUMN query.work_item_views.title IS 'Titre (texte libre) ; classe I';
COMMENT ON COLUMN query.work_item_views.state_key IS 'État ; classe I';
COMMENT ON COLUMN query.work_item_views.state_category IS 'Catégorie ; classe P';
COMMENT ON COLUMN query.work_item_views.workflow_version_id IS 'Version de workflow ; classe I';
COMMENT ON COLUMN query.work_item_views.priority IS 'Priorité ; classe P';
COMMENT ON COLUMN query.work_item_views.parent_id IS 'Parent ; classe I';
COMMENT ON COLUMN query.work_item_views.assignee_id IS 'Responsable ; classe D';
COMMENT ON COLUMN query.work_item_views.estimate IS 'Estimation ; classe I';
COMMENT ON COLUMN query.work_item_views.rank IS 'Rang ; classe I';
COMMENT ON COLUMN query.work_item_views.confidentiality IS 'Confidentialité ; classe I';
COMMENT ON COLUMN query.work_item_views.deleted IS 'En corbeille ; classe I';
COMMENT ON COLUMN query.work_item_views.aggregate_version IS 'Version de l''élément projetée (ordre par agrégat) ; classe I';
COMMENT ON COLUMN query.work_item_views.tsv IS 'Index plein texte français (clé et titre) ; classe I';

CREATE TABLE query.activity_entries (
  organisation_id uuid NOT NULL,
  seq bigint GENERATED ALWAYS AS IDENTITY,
  project_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL,
  event_code text NOT NULL,
  resource_key text,
  actor_ref uuid,
  params jsonb NOT NULL,
  correlation_id text NOT NULL,
  CONSTRAINT pk_activity_entries PRIMARY KEY (organisation_id, seq)
);
CREATE INDEX ix_activity_entries_project ON query.activity_entries (organisation_id, project_id, seq DESC);
COMMENT ON TABLE query.activity_entries IS 'Journal d''activité fonctionnel consultable (identifiants et valeurs énumérées uniquement)';
COMMENT ON COLUMN query.activity_entries.organisation_id IS 'Organisation (RLS) ; classe I';
COMMENT ON COLUMN query.activity_entries.seq IS 'Ordre ; classe I';
COMMENT ON COLUMN query.activity_entries.project_id IS 'Projet ; classe I';
COMMENT ON COLUMN query.activity_entries.occurred_at IS 'Date ; classe I';
COMMENT ON COLUMN query.activity_entries.event_code IS 'Type d''événement ; classe P';
COMMENT ON COLUMN query.activity_entries.resource_key IS 'Clé de la ressource ; classe I';
COMMENT ON COLUMN query.activity_entries.actor_ref IS 'Acteur (identifiant opaque) ; classe D';
COMMENT ON COLUMN query.activity_entries.params IS 'Paramètres de classe P et I, sans texte libre ; classe I';
COMMENT ON COLUMN query.activity_entries.correlation_id IS 'Corrélation ; classe I';

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects', 'workflow_states', 'work_item_views', 'activity_entries'] LOOP
    EXECUTE format('ALTER TABLE query.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE query.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY p_%s_organisation ON query.%I USING (organisation_id = nullif(current_setting(''app.organisation_id'', true), '''')::uuid)', t, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON query.projects, query.workflow_states, query.work_item_views, query.activity_entries TO pv_query_app;
