-- Single-file schema for the MVP. Re-runnable (IF NOT EXISTS).

-- Every raw payload we've received, plus the canonical "golden" captured the
-- first time it was parsed. Deduplicated by content hash so the replay corpus
-- holds genuinely distinct payloads, not redeliveries.
CREATE TABLE IF NOT EXISTS raw_payloads (
  id              uuid PRIMARY KEY,
  provider        text NOT NULL,
  content_hash    text NOT NULL UNIQUE,
  payload         jsonb NOT NULL,
  fingerprint     text NOT NULL,
  parser_version  int  NOT NULL,
  golden          jsonb NOT NULL,
  received_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS raw_payloads_provider_idx ON raw_payloads (provider);

-- The canonical events. One row per dedup_key. Identity fields are written once;
-- cost/tokens get backfilled and bump revision.
CREATE TABLE IF NOT EXISTS events (
  event_id        uuid PRIMARY KEY,
  dedup_key       text NOT NULL UNIQUE,
  provider        text NOT NULL,
  parser_version  int  NOT NULL,
  raw_payload_id  uuid NOT NULL,
  occurred_at     timestamptz NOT NULL,
  event_type      text NOT NULL,
  model           text,
  raw_user_id     text,
  input_tokens    int,
  output_tokens   int,
  cost_amount_usd numeric,
  revision        int NOT NULL DEFAULT 1,
  ingested_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_provider_ingested_idx ON events (provider, ingested_at DESC);
CREATE INDEX IF NOT EXISTS events_provider_occurred_idx ON events (provider, occurred_at);

-- Drift alerts the dashboard reads.
CREATE TABLE IF NOT EXISTS drift_alerts (
  id          bigserial PRIMARY KEY,
  provider    text NOT NULL,
  type        text NOT NULL,
  severity    text NOT NULL,
  field       text,
  message     text NOT NULL,
  details     jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS drift_alerts_created_idx ON drift_alerts (created_at DESC);
