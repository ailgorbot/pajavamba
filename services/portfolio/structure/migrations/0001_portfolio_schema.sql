-- Schéma du service portfolio (§6.5.2) : projets et cycle de vie, équipes, appartenances.
-- Règles : RI-DON-01 à RI-DON-03, RG-PRJ-001 (clé unique et immuable par organisation).
CREATE SCHEMA IF NOT EXISTS portfolio;
COMMENT ON SCHEMA portfolio IS 'Service portfolio : projets, cycle de vie et équipes';

DO $$ BEGIN
  CREATE ROLE pv_portfolio_app NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
GRANT USAGE ON SCHEMA portfolio TO pv_portfolio_app;
SELECT pv_ops.create_service_tables('portfolio', 'pv_portfolio_app');

CREATE TABLE portfolio.projects (
  organisation_id uuid NOT NULL,
  id uuid NOT NULL,
  key text NOT NULL CHECK (key ~ '^[A-Z][A-Z0-9]{1,9}$'),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 10000),
  status text NOT NULL CHECK (status IN ('draft', 'active', 'closed', 'archived', 'pending_deletion')),
  visibility text NOT NULL CHECK (visibility IN ('private', 'internal', 'public')),
  sensitivity text NOT NULL DEFAULT 'standard' CHECK (sensitivity IN ('standard', 'sensitive')),
  methodology_pack_key text NOT NULL CHECK (methodology_pack_key IN ('scrum', 'kanban', 'scrumban', 'custom')),
  time_zone text NOT NULL CHECK (length(time_zone) BETWEEN 1 AND 64),
  configuration_ready boolean NOT NULL DEFAULT false,
  open_item_count integer NOT NULL DEFAULT 0 CHECK (open_item_count >= 0),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closure_summary text CHECK (length(closure_summary) <= 10000),
  archived_at timestamptz,
  deletion_scheduled_for timestamptz,
  deletion_from_status text CHECK (deletion_from_status IN ('draft', 'archived')),
  version integer NOT NULL,
  CONSTRAINT pk_projects PRIMARY KEY (organisation_id, id),
  CONSTRAINT ux_projects_id UNIQUE (id),
  CONSTRAINT ux_projects_key UNIQUE (organisation_id, key)
);
CREATE INDEX ix_projects_purge ON portfolio.projects (deletion_scheduled_for) WHERE status = 'pending_deletion';
COMMENT ON TABLE portfolio.projects IS 'Projets et leur cycle de vie (§2.4)';
COMMENT ON COLUMN portfolio.projects.organisation_id IS 'Organisation (RLS) ; classe I';
COMMENT ON COLUMN portfolio.projects.id IS 'Identifiant (UUIDv7), exposé en base58 ; classe I ; IA N0';
COMMENT ON COLUMN portfolio.projects.key IS 'Clé unique et immuable (RG-PRJ-001) ; classe I ; IA N0';
COMMENT ON COLUMN portfolio.projects.name IS 'Nom ; classe I ; IA N0';
COMMENT ON COLUMN portfolio.projects.description IS 'Présentation (Markdown, texte libre) ; classe I ; IA N2';
COMMENT ON COLUMN portfolio.projects.status IS 'Statut du cycle de vie ; classe I ; IA N1';
COMMENT ON COLUMN portfolio.projects.visibility IS 'Visibilité ; classe I';
COMMENT ON COLUMN portfolio.projects.sensitivity IS 'Sensibilité (RG-PRJ-008) ; classe I';
COMMENT ON COLUMN portfolio.projects.methodology_pack_key IS 'Modèle méthodologique ; classe P ; IA N1';
COMMENT ON COLUMN portfolio.projects.time_zone IS 'Fuseau du projet ; classe P';
COMMENT ON COLUMN portfolio.projects.configuration_ready IS 'Types et workflows publiés (condition d''activation) ; classe I';
COMMENT ON COLUMN portfolio.projects.open_item_count IS 'Éléments non terminés (condition de clôture) ; classe I';
COMMENT ON COLUMN portfolio.projects.created_by IS 'Créateur ; classe D';
COMMENT ON COLUMN portfolio.projects.created_at IS 'Date de création ; classe I';
COMMENT ON COLUMN portfolio.projects.closed_at IS 'Date de clôture ; classe I';
COMMENT ON COLUMN portfolio.projects.closure_summary IS 'Bilan de clôture (texte libre) ; classe I ; IA N2';
COMMENT ON COLUMN portfolio.projects.archived_at IS 'Date d''archivage ; classe I';
COMMENT ON COLUMN portfolio.projects.deletion_scheduled_for IS 'Échéance de purge ; classe I';
COMMENT ON COLUMN portfolio.projects.deletion_from_status IS 'Statut restauré si la suppression est annulée ; classe I';
COMMENT ON COLUMN portfolio.projects.version IS 'Version d''agrégat (ETag) ; classe I';

CREATE TABLE portfolio.teams (
  organisation_id uuid NOT NULL,
  id uuid NOT NULL,
  key text NOT NULL CHECK (key ~ '^[A-Z][A-Z0-9]{1,5}$'),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  kind text NOT NULL CHECK (kind IN ('scrum', 'kanban', 'scrumban', 'other')),
  time_zone text NOT NULL CHECK (length(time_zone) BETWEEN 1 AND 64),
  working_days smallint[] NOT NULL,
  default_focus_factor numeric(3, 2) NOT NULL DEFAULT 0.80,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  version integer NOT NULL,
  CONSTRAINT pk_teams PRIMARY KEY (organisation_id, id),
  CONSTRAINT ux_teams_key UNIQUE (organisation_id, key)
);
COMMENT ON TABLE portfolio.teams IS 'Équipes (notion métier distincte des groupes)';
COMMENT ON COLUMN portfolio.teams.organisation_id IS 'Organisation (RLS) ; classe I';
COMMENT ON COLUMN portfolio.teams.id IS 'Identifiant (UUIDv7) ; classe I';
COMMENT ON COLUMN portfolio.teams.key IS 'Clé d''équipe ; classe I';
COMMENT ON COLUMN portfolio.teams.name IS 'Nom ; classe I';
COMMENT ON COLUMN portfolio.teams.kind IS 'Nature ; classe P';
COMMENT ON COLUMN portfolio.teams.time_zone IS 'Fuseau de l''équipe ; classe P';
COMMENT ON COLUMN portfolio.teams.working_days IS 'Jours travaillés (1 = lundi) ; classe P';
COMMENT ON COLUMN portfolio.teams.default_focus_factor IS 'Facteur de focus par défaut ; classe I';
COMMENT ON COLUMN portfolio.teams.status IS 'Statut ; classe I';
COMMENT ON COLUMN portfolio.teams.version IS 'Version d''agrégat ; classe I';

CREATE TABLE portfolio.team_memberships (
  organisation_id uuid NOT NULL,
  team_id uuid NOT NULL,
  user_id uuid NOT NULL,
  team_role text NOT NULL CHECK (team_role IN ('member', 'scrum_master', 'product_owner', 'other')),
  allocation_percent smallint NOT NULL CHECK (allocation_percent BETWEEN 1 AND 100),
  CONSTRAINT pk_team_memberships PRIMARY KEY (organisation_id, team_id, user_id),
  CONSTRAINT fk_team_memberships_team FOREIGN KEY (organisation_id, team_id) REFERENCES portfolio.teams (organisation_id, id) ON DELETE CASCADE
);
CREATE INDEX ix_team_memberships_team ON portfolio.team_memberships (organisation_id, team_id);
COMMENT ON TABLE portfolio.team_memberships IS 'Appartenances aux équipes (aucune donnée individuelle de performance)';
COMMENT ON COLUMN portfolio.team_memberships.organisation_id IS 'Organisation (RLS) ; classe I';
COMMENT ON COLUMN portfolio.team_memberships.team_id IS 'Équipe ; classe I';
COMMENT ON COLUMN portfolio.team_memberships.user_id IS 'Membre ; classe D';
COMMENT ON COLUMN portfolio.team_memberships.team_role IS 'Rôle dans l''équipe ; classe I';
COMMENT ON COLUMN portfolio.team_memberships.allocation_percent IS 'Allocation (1 à 100 %) ; classe I';

CREATE TABLE portfolio.project_teams (
  organisation_id uuid NOT NULL,
  project_id uuid NOT NULL,
  team_id uuid NOT NULL,
  CONSTRAINT pk_project_teams PRIMARY KEY (organisation_id, project_id, team_id),
  CONSTRAINT fk_project_teams_project FOREIGN KEY (organisation_id, project_id) REFERENCES portfolio.projects (organisation_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_project_teams_team FOREIGN KEY (organisation_id, team_id) REFERENCES portfolio.teams (organisation_id, id)
);
CREATE INDEX ix_project_teams_project ON portfolio.project_teams (organisation_id, project_id);
CREATE INDEX ix_project_teams_team ON portfolio.project_teams (organisation_id, team_id);
COMMENT ON TABLE portfolio.project_teams IS 'Rattachement des équipes aux projets';
COMMENT ON COLUMN portfolio.project_teams.organisation_id IS 'Organisation (RLS) ; classe I';
COMMENT ON COLUMN portfolio.project_teams.project_id IS 'Projet ; classe I';
COMMENT ON COLUMN portfolio.project_teams.team_id IS 'Équipe ; classe I';

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects', 'teams', 'team_memberships', 'project_teams'] LOOP
    EXECUTE format('ALTER TABLE portfolio.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE portfolio.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY p_%s_organisation ON portfolio.%I USING (organisation_id = nullif(current_setting(''app.organisation_id'', true), '''')::uuid)', t, t);
  END LOOP;
END $$;

-- La purge planifiée parcourt toutes les organisations : fonction étroite, droits du propriétaire.
CREATE FUNCTION portfolio.projects_due_for_purge(p_now timestamptz)
RETURNS TABLE (organisation_id uuid, id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = portfolio, pg_temp AS $$
  SELECT p.organisation_id, p.id FROM portfolio.projects p
  WHERE p.status = 'pending_deletion' AND p.deletion_scheduled_for <= p_now
$$;
COMMENT ON FUNCTION portfolio.projects_due_for_purge(timestamptz) IS 'Projets dont le délai de grâce est échu (RG-PRJ-007)';
REVOKE ALL ON FUNCTION portfolio.projects_due_for_purge(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION portfolio.projects_due_for_purge(timestamptz) TO pv_portfolio_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON portfolio.projects, portfolio.teams, portfolio.team_memberships, portfolio.project_teams TO pv_portfolio_app;
