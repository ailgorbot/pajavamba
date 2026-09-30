-- Schéma du service workitem (§6.5.3) : éléments, types, versions de workflow copiées,
-- commentaires, historique. Règles : RG-WI-001 (numéros jamais réutilisés), RI-DON-01 à 03, RI-DON-08.
CREATE SCHEMA IF NOT EXISTS workitem;
COMMENT ON SCHEMA workitem IS 'Service workitem : éléments de travail, hiérarchie, commentaires';

DO $$ BEGIN
  CREATE ROLE pv_workitem_app NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
GRANT USAGE ON SCHEMA workitem TO pv_workitem_app;
SELECT pv_ops.create_service_tables('workitem', 'pv_workitem_app');

CREATE TABLE workitem.projects (
  organisation_id uuid NOT NULL,
  id uuid NOT NULL,
  key text NOT NULL,
  status text NOT NULL,
  next_item_number bigint NOT NULL DEFAULT 1,
  CONSTRAINT pk_projects PRIMARY KEY (organisation_id, id),
  CONSTRAINT ux_projects_key UNIQUE (organisation_id, key)
);
COMMENT ON TABLE workitem.projects IS 'Projection des projets (source : portfolio) et compteur des numéros d''éléments';
COMMENT ON COLUMN workitem.projects.organisation_id IS 'Organisation (RLS) ; classe I';
COMMENT ON COLUMN workitem.projects.id IS 'Projet ; classe I';
COMMENT ON COLUMN workitem.projects.key IS 'Clé du projet ; classe I';
COMMENT ON COLUMN workitem.projects.status IS 'Statut du cycle de vie ; classe I';
COMMENT ON COLUMN workitem.projects.next_item_number IS 'Prochain numéro d''élément (RG-WI-001) ; classe I';

CREATE TABLE workitem.work_item_types (
  organisation_id uuid NOT NULL,
  project_id uuid NOT NULL,
  key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  level smallint NOT NULL CHECK (level BETWEEN 1 AND 7),
  allowed_parent_type_keys text[] NOT NULL,
  workflow_key text NOT NULL,
  CONSTRAINT pk_work_item_types PRIMARY KEY (organisation_id, project_id, key),
  CONSTRAINT fk_work_item_types_project FOREIGN KEY (organisation_id, project_id) REFERENCES workitem.projects (organisation_id, id) ON DELETE CASCADE
);
COMMENT ON TABLE workitem.work_item_types IS 'Types d''éléments et hiérarchie configurable du projet';
COMMENT ON COLUMN workitem.work_item_types.organisation_id IS 'Organisation (RLS) ; classe I';
COMMENT ON COLUMN workitem.work_item_types.project_id IS 'Projet ; classe I';
COMMENT ON COLUMN workitem.work_item_types.key IS 'Clé technique ; classe P';
COMMENT ON COLUMN workitem.work_item_types.name IS 'Libellé ; classe P';
COMMENT ON COLUMN workitem.work_item_types.level IS 'Niveau hiérarchique ; classe P';
COMMENT ON COLUMN workitem.work_item_types.allowed_parent_type_keys IS 'Types admis comme parent (RG-WI-002) ; classe P';
COMMENT ON COLUMN workitem.work_item_types.workflow_key IS 'Workflow du type ; classe P';

CREATE TABLE workitem.workflow_versions (
  organisation_id uuid NOT NULL,
  id uuid NOT NULL,
  project_id uuid NOT NULL,
  workflow_key text NOT NULL,
  number integer NOT NULL,
  definition jsonb NOT NULL,
  CONSTRAINT pk_workflow_versions PRIMARY KEY (organisation_id, id),
  CONSTRAINT fk_workflow_versions_project FOREIGN KEY (organisation_id, project_id) REFERENCES workitem.projects (organisation_id, id) ON DELETE CASCADE
);
CREATE INDEX ix_workflow_versions_project ON workitem.workflow_versions (organisation_id, project_id, workflow_key, number DESC);
COMMENT ON TABLE workitem.workflow_versions IS 'Copies immuables des versions de workflow publiées (RG-WF-001)';
COMMENT ON COLUMN workitem.workflow_versions.organisation_id IS 'Organisation (RLS) ; classe I';
COMMENT ON COLUMN workitem.workflow_versions.id IS 'Version publiée ; classe I';
COMMENT ON COLUMN workitem.workflow_versions.project_id IS 'Projet ; classe I';
COMMENT ON COLUMN workitem.workflow_versions.workflow_key IS 'Clé du workflow ; classe P';
COMMENT ON COLUMN workitem.workflow_versions.number IS 'Numéro de version ; classe P';
COMMENT ON COLUMN workitem.workflow_versions.definition IS 'États et transitions ; classe P';

CREATE TABLE workitem.work_items (
  organisation_id uuid NOT NULL,
  id uuid NOT NULL,
  project_id uuid NOT NULL,
  number bigint NOT NULL,
  key text NOT NULL,
  type_key text NOT NULL,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 255),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 65535),
  acceptance_criteria text NOT NULL DEFAULT '' CHECK (length(acceptance_criteria) <= 20000),
  state_key text NOT NULL,
  state_category text NOT NULL CHECK (state_category IN ('todo', 'in_progress', 'done')),
  workflow_version_id uuid NOT NULL,
  workflow_key text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('lowest', 'low', 'medium', 'high', 'highest')),
  parent_id uuid,
  ancestors uuid[] NOT NULL DEFAULT '{}',
  assignee_id uuid,
  reporter_id uuid,
  estimate numeric(8, 2) CHECK (estimate >= 0),
  rank text NOT NULL COLLATE "C",
  confidentiality text NOT NULL CHECK (confidentiality IN ('normal', 'restricted')),
  created_via text NOT NULL CHECK (created_via IN ('ui', 'api', 'mcp', 'import', 'plugin', 'automation')),
  created_at timestamptz NOT NULL,
  resolved_at timestamptz,
  deleted_at timestamptz,
  version integer NOT NULL,
  CONSTRAINT pk_work_items PRIMARY KEY (organisation_id, id),
  CONSTRAINT ux_work_items_key UNIQUE (organisation_id, key),
  CONSTRAINT ux_work_items_number UNIQUE (organisation_id, project_id, number),
  CONSTRAINT fk_work_items_project FOREIGN KEY (organisation_id, project_id) REFERENCES workitem.projects (organisation_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_work_items_parent FOREIGN KEY (organisation_id, parent_id) REFERENCES workitem.work_items (organisation_id, id),
  CONSTRAINT fk_work_items_version FOREIGN KEY (organisation_id, workflow_version_id) REFERENCES workitem.workflow_versions (organisation_id, id)
);
CREATE INDEX ix_work_items_project_rank ON workitem.work_items (organisation_id, project_id, rank) WHERE deleted_at IS NULL;
CREATE INDEX ix_work_items_parent ON workitem.work_items (organisation_id, parent_id);
CREATE INDEX ix_work_items_version ON workitem.work_items (organisation_id, workflow_version_id);
COMMENT ON TABLE workitem.work_items IS 'Éléments de travail';
COMMENT ON COLUMN workitem.work_items.organisation_id IS 'Organisation (RLS) ; classe I';
COMMENT ON COLUMN workitem.work_items.id IS 'Identifiant (UUIDv7) ; classe I ; IA N0';
COMMENT ON COLUMN workitem.work_items.project_id IS 'Projet ; classe I ; IA N0';
COMMENT ON COLUMN workitem.work_items.number IS 'Numéro dans le projet ; classe I ; IA N0';
COMMENT ON COLUMN workitem.work_items.key IS 'Clé <projet>-<n> ; classe I ; IA N0';
COMMENT ON COLUMN workitem.work_items.type_key IS 'Type ; classe I ; IA N0';
COMMENT ON COLUMN workitem.work_items.title IS 'Titre (texte libre) ; classe I ; IA N0';
COMMENT ON COLUMN workitem.work_items.description IS 'Description (Markdown, texte libre) ; classe I ; IA N2';
COMMENT ON COLUMN workitem.work_items.acceptance_criteria IS 'Critères d''acceptation (texte libre) ; classe I ; IA N2';
COMMENT ON COLUMN workitem.work_items.state_key IS 'État courant ; classe I ; IA N1';
COMMENT ON COLUMN workitem.work_items.state_category IS 'Catégorie de l''état ; classe P ; IA N1';
COMMENT ON COLUMN workitem.work_items.workflow_version_id IS 'Version de workflow rattachée (RG-WI-005) ; classe I';
COMMENT ON COLUMN workitem.work_items.workflow_key IS 'Workflow rattaché ; classe P';
COMMENT ON COLUMN workitem.work_items.priority IS 'Priorité ; classe P ; IA N1';
COMMENT ON COLUMN workitem.work_items.parent_id IS 'Parent ; classe I ; IA N0';
COMMENT ON COLUMN workitem.work_items.ancestors IS 'Chemin hiérarchique matérialisé (RG-WI-003) ; classe I';
COMMENT ON COLUMN workitem.work_items.assignee_id IS 'Responsable ; classe D ; IA N1 pseudonymisé';
COMMENT ON COLUMN workitem.work_items.reporter_id IS 'Rapporteur ; classe D ; IA N1 pseudonymisé';
COMMENT ON COLUMN workitem.work_items.estimate IS 'Estimation ; classe I ; IA N1';
COMMENT ON COLUMN workitem.work_items.rank IS 'Rang lexicographique dans le backlog ; classe I';
COMMENT ON COLUMN workitem.work_items.confidentiality IS 'Confidentialité (RG-WI-007) ; classe I';
COMMENT ON COLUMN workitem.work_items.created_via IS 'Canal de création ; classe P';
COMMENT ON COLUMN workitem.work_items.created_at IS 'Date de création ; classe I ; IA N1';
COMMENT ON COLUMN workitem.work_items.resolved_at IS 'Date de résolution ; classe I ; IA N1';
COMMENT ON COLUMN workitem.work_items.deleted_at IS 'Mise en corbeille (RG-WI-008) ; classe I';
COMMENT ON COLUMN workitem.work_items.version IS 'Version d''agrégat (ETag) ; classe I';

CREATE TABLE workitem.comments (
  organisation_id uuid NOT NULL,
  id uuid NOT NULL,
  work_item_id uuid NOT NULL,
  author_id uuid,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 20000),
  created_via text NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT pk_comments PRIMARY KEY (organisation_id, id),
  CONSTRAINT fk_comments_work_item FOREIGN KEY (organisation_id, work_item_id) REFERENCES workitem.work_items (organisation_id, id) ON DELETE CASCADE
);
CREATE INDEX ix_comments_work_item ON workitem.comments (organisation_id, work_item_id, created_at);
COMMENT ON TABLE workitem.comments IS 'Commentaires des éléments';
COMMENT ON COLUMN workitem.comments.organisation_id IS 'Organisation (RLS) ; classe I';
COMMENT ON COLUMN workitem.comments.id IS 'Identifiant (UUIDv7) ; classe I';
COMMENT ON COLUMN workitem.comments.work_item_id IS 'Élément ; classe I';
COMMENT ON COLUMN workitem.comments.author_id IS 'Auteur ; classe D ; IA N3 pseudonymisé';
COMMENT ON COLUMN workitem.comments.body IS 'Texte (Markdown, texte libre) ; classe I ; IA N3';
COMMENT ON COLUMN workitem.comments.created_via IS 'Canal ; classe P';
COMMENT ON COLUMN workitem.comments.created_at IS 'Date ; classe I';

CREATE TABLE workitem.work_item_history (
  organisation_id uuid NOT NULL,
  seq bigint GENERATED ALWAYS AS IDENTITY,
  work_item_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  changes jsonb NOT NULL,
  CONSTRAINT pk_work_item_history PRIMARY KEY (organisation_id, seq),
  CONSTRAINT fk_work_item_history_work_item FOREIGN KEY (organisation_id, work_item_id) REFERENCES workitem.work_items (organisation_id, id) ON DELETE CASCADE
);
CREATE INDEX ix_work_item_history_work_item ON workitem.work_item_history (organisation_id, work_item_id, seq);
COMMENT ON TABLE workitem.work_item_history IS 'Historique des modifications d''un élément';
COMMENT ON COLUMN workitem.work_item_history.organisation_id IS 'Organisation (RLS) ; classe I';
COMMENT ON COLUMN workitem.work_item_history.seq IS 'Ordre ; classe I';
COMMENT ON COLUMN workitem.work_item_history.work_item_id IS 'Élément ; classe I';
COMMENT ON COLUMN workitem.work_item_history.occurred_at IS 'Date ; classe I';
COMMENT ON COLUMN workitem.work_item_history.actor_id IS 'Auteur ; classe D';
COMMENT ON COLUMN workitem.work_item_history.action IS 'Nature du changement ; classe P';
COMMENT ON COLUMN workitem.work_item_history.changes IS 'Champs modifiés ; valeurs longues jamais recopiées ; classe I';

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects', 'work_item_types', 'workflow_versions', 'work_items', 'comments', 'work_item_history'] LOOP
    EXECUTE format('ALTER TABLE workitem.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE workitem.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY p_%s_organisation ON workitem.%I USING (organisation_id = nullif(current_setting(''app.organisation_id'', true), '''')::uuid)', t, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON workitem.projects, workitem.work_item_types, workitem.workflow_versions, workitem.work_items, workitem.comments, workitem.work_item_history TO pv_workitem_app;
