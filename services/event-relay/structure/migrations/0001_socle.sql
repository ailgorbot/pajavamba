-- Socle commun : extensions, rôle du relais, fonction de création des tables techniques
-- présentes dans chaque schéma de service (§6.4 : outbox_events, processed_events, idempotency_keys).
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS ltree;

CREATE SCHEMA IF NOT EXISTS pv_ops;
COMMENT ON SCHEMA pv_ops IS 'Objets techniques du socle (migrations, fonctions d''installation)';

DO $$ BEGIN
  CREATE ROLE pv_event_relay_app NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE SCHEMA IF NOT EXISTS events;
COMMENT ON SCHEMA events IS 'Service event-relay : lettres mortes';
GRANT USAGE ON SCHEMA events TO pv_event_relay_app;

CREATE TABLE events.dead_letters (
  id uuid NOT NULL,
  source_schema text NOT NULL,
  event_id uuid NOT NULL,
  consumer text NOT NULL,
  event_type text NOT NULL,
  attempts integer NOT NULL,
  error_class text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_dead_letters PRIMARY KEY (id)
);
COMMENT ON TABLE events.dead_letters IS 'Événements non traités après reprises, en attente de rejeu';
COMMENT ON COLUMN events.dead_letters.id IS 'Identifiant (UUIDv7)';
COMMENT ON COLUMN events.dead_letters.source_schema IS 'Schéma d''origine de l''événement';
COMMENT ON COLUMN events.dead_letters.event_id IS 'Identifiant de l''événement';
COMMENT ON COLUMN events.dead_letters.consumer IS 'Consommateur en échec';
COMMENT ON COLUMN events.dead_letters.event_type IS 'Type de l''événement';
COMMENT ON COLUMN events.dead_letters.attempts IS 'Nombre de tentatives';
COMMENT ON COLUMN events.dead_letters.error_class IS 'Classe d''erreur (jamais le message brut)';
COMMENT ON COLUMN events.dead_letters.created_at IS 'Date de mise en lettre morte';
GRANT SELECT, INSERT ON events.dead_letters TO pv_event_relay_app;

CREATE OR REPLACE FUNCTION pv_ops.create_service_tables(p_schema text, p_role text) RETURNS void
LANGUAGE plpgsql AS $fn$
BEGIN
  EXECUTE format($sql$
    CREATE TABLE %1$I.outbox_events (
      seq bigint GENERATED ALWAYS AS IDENTITY,
      id uuid NOT NULL,
      organisation_id uuid,
      kind text NOT NULL CHECK (kind IN ('event', 'audit')),
      type text NOT NULL CHECK (length(type) <= 120),
      aggregate_id text NOT NULL,
      aggregate_version integer NOT NULL,
      correlation_id text NOT NULL,
      actor_id uuid,
      payload jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      published_at timestamptz,
      CONSTRAINT pk_outbox_events PRIMARY KEY (seq),
      CONSTRAINT ux_outbox_events_id UNIQUE (id)
    );
    CREATE INDEX ix_outbox_events_pending ON %1$I.outbox_events (seq) WHERE published_at IS NULL;
    COMMENT ON TABLE %1$I.outbox_events IS 'Outbox transactionnelle du service (événements et audit)';
    COMMENT ON COLUMN %1$I.outbox_events.seq IS 'Ordre de publication';
    COMMENT ON COLUMN %1$I.outbox_events.id IS 'Identifiant de l''événement (UUIDv7) ; classe I';
    COMMENT ON COLUMN %1$I.outbox_events.organisation_id IS 'Organisation ; classe I';
    COMMENT ON COLUMN %1$I.outbox_events.kind IS 'Événement métier ou entrée d''audit ; classe P';
    COMMENT ON COLUMN %1$I.outbox_events.type IS 'Type versionné ; classe P';
    COMMENT ON COLUMN %1$I.outbox_events.aggregate_id IS 'Agrégat concerné ; classe I';
    COMMENT ON COLUMN %1$I.outbox_events.aggregate_version IS 'Version de l''agrégat ; classe I';
    COMMENT ON COLUMN %1$I.outbox_events.correlation_id IS 'Corrélation de la requête ; classe I';
    COMMENT ON COLUMN %1$I.outbox_events.actor_id IS 'Acteur ; classe D';
    COMMENT ON COLUMN %1$I.outbox_events.payload IS 'Données internes (aucune valeur S ou X)';
    COMMENT ON COLUMN %1$I.outbox_events.created_at IS 'Date d''écriture ; classe I';
    COMMENT ON COLUMN %1$I.outbox_events.published_at IS 'Date de publication par le relais ; classe I';

    CREATE TABLE %1$I.processed_events (
      consumer text NOT NULL,
      event_id uuid NOT NULL,
      processed_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT pk_processed_events PRIMARY KEY (consumer, event_id)
    );
    COMMENT ON TABLE %1$I.processed_events IS 'Événements déjà traités par consommateur (idempotence)';
    COMMENT ON COLUMN %1$I.processed_events.consumer IS 'Nom du consommateur ; classe P';
    COMMENT ON COLUMN %1$I.processed_events.event_id IS 'Identifiant de l''événement ; classe I';
    COMMENT ON COLUMN %1$I.processed_events.processed_at IS 'Date de traitement ; classe I';

    CREATE TABLE %1$I.idempotency_keys (
      key text NOT NULL CHECK (length(key) BETWEEN 8 AND 100),
      organisation_id uuid,
      request_hash text NOT NULL,
      status_code integer NOT NULL,
      response jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT pk_idempotency_keys PRIMARY KEY (key)
    );
    COMMENT ON TABLE %1$I.idempotency_keys IS 'Réponses rejouables des écritures, conservées 24 heures';
    COMMENT ON COLUMN %1$I.idempotency_keys.key IS 'Clé Idempotency-Key fournie par le client ; classe I';
    COMMENT ON COLUMN %1$I.idempotency_keys.organisation_id IS 'Organisation ; classe I';
    COMMENT ON COLUMN %1$I.idempotency_keys.request_hash IS 'Empreinte de la requête ; classe I';
    COMMENT ON COLUMN %1$I.idempotency_keys.status_code IS 'Statut HTTP produit ; classe P';
    COMMENT ON COLUMN %1$I.idempotency_keys.response IS 'Corps de réponse produit ; classe I';
    COMMENT ON COLUMN %1$I.idempotency_keys.created_at IS 'Date de création ; classe I';

    GRANT SELECT, INSERT, UPDATE ON %1$I.outbox_events, %1$I.processed_events, %1$I.idempotency_keys TO %2$I;
    GRANT USAGE ON SCHEMA %1$I TO pv_event_relay_app;
    GRANT SELECT, UPDATE ON %1$I.outbox_events TO pv_event_relay_app;
  $sql$, p_schema, p_role);
END
$fn$;
COMMENT ON FUNCTION pv_ops.create_service_tables(text, text) IS 'Crée les tables techniques communes d''un schéma de service';
