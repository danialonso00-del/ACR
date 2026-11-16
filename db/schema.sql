-- Target PostgreSQL schema for the pilot / production phase.
-- The local demo uses an in-memory adapter (src/lib/data/repository.ts) behind
-- the same domain contract; this schema is the persistence target, not yet wired.
-- Nullable columns represent "not reported"; originals are kept next to derived values.

CREATE TABLE source_snapshot (
  id             text PRIMARY KEY,               -- e.g. sdr-2026-c4db2116
  kind           text NOT NULL,                  -- export_csv | list_html | gallery_html | import
  url            text,
  query_params   jsonb NOT NULL DEFAULT '{}',
  captured_at    timestamptz NOT NULL,
  sha256         char(64) NOT NULL,
  raw_object_key text NOT NULL,                  -- S3-compatible key of the immutable raw file
  parser_version text,
  licence        text,
  status         text NOT NULL DEFAULT 'ok',     -- ok | partial | error
  errors         jsonb NOT NULL DEFAULT '[]'
);

CREATE TABLE circuit (
  id          bigserial PRIMARY KEY,
  source_key  text UNIQUE NOT NULL,              -- normalised name|titular (identity resolved, not fuzzy)
  name        text NOT NULL,
  stream      text NOT NULL CHECK (stream IN ('FORM','RESTA','REBUIG')),
  titular     text,
  valid_from  date,
  valid_to    date
);

CREATE TABLE circuit_municipality (
  circuit_id        bigint REFERENCES circuit(id),
  municipality_code char(6) NOT NULL,           -- INE/Idescat code (ICGC)
  valid_from        date,
  valid_to          date,
  weight            numeric,                    -- only when an accredited source exists
  weight_source     text,
  PRIMARY KEY (circuit_id, municipality_code, valid_from)
);

CREATE TABLE characterization (
  id                  text NOT NULL,            -- bulletin id at source
  version             int  NOT NULL DEFAULT 1,  -- corrections at source create a new version
  mode                text NOT NULL CHECK (mode IN ('public_snapshot','imported','synthetic_demo')),
  circuit_id          bigint REFERENCES circuit(id),
  stream              text NOT NULL,
  protocol_version    text,
  sampling_date       date,
  characterization_date date,
  reception_date      date,
  presentation_date   date,
  acceptance_date     date,
  bulletin_year       int,
  bulletin_quarter    int,
  status              text,
  stopped             boolean,                   -- "abortada" (not in the public export)
  company             text,
  facility            text,
  sample_kg           numeric,
  total_weighed_kg    numeric,
  losses_kg           numeric,
  reference_kg        numeric,                   -- derived: total + losses
  impropis_pct        numeric,                   -- derived
  impropis_pct_reported numeric,
  observations        jsonb,                     -- untrusted free text
  snapshot_id         text REFERENCES source_snapshot(id),
  row_hash            char(16) NOT NULL,
  is_current          boolean NOT NULL DEFAULT true,
  PRIMARY KEY (id, version, mode)
);
CREATE INDEX characterization_scope_idx ON characterization (mode, stream, sampling_date) WHERE is_current;

CREATE TABLE fraction_measurement (
  characterization_id text NOT NULL,
  version             int  NOT NULL,
  mode                text NOT NULL,
  original_code       text NOT NULL,             -- source column / code
  canonical_category  text NOT NULL,             -- vidre, paper, ... (taxonomy version below)
  taxonomy_version    text NOT NULL,
  kg                  numeric,
  correction_factor   numeric,
  pct_reported        numeric,
  denominator         text NOT NULL,             -- e.g. 'total+losses'
  pct_computed        numeric,
  unit                text NOT NULL DEFAULT 'kg',
  quality             text,
  PRIMARY KEY (characterization_id, version, mode, canonical_category),
  FOREIGN KEY (characterization_id, version, mode) REFERENCES characterization(id, version, mode)
);

CREATE TABLE photo (
  image_id            text PRIMARY KEY,
  characterization_id text NOT NULL,
  ord                 int,
  type_code           text,
  type_label          text,
  kind                text,
  source_url          text NOT NULL,
  stored_object_key   text,                      -- only if rights allow storing
  sha256              char(64),
  access              text NOT NULL DEFAULT 'public_view',
  rights              text NOT NULL,             -- reuse / publication / training status
  metadata            jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE photo_annotation (
  id            bigserial PRIMARY KEY,
  image_id      text REFERENCES photo(image_id),
  origin        text NOT NULL CHECK (origin IN ('manual','model')),
  label         text NOT NULL,
  geometry      jsonb,
  model_version text,
  confidence    numeric,
  reviewed_by   text,
  reviewed_at   timestamptz
);

CREATE TABLE quality_issue (
  id                  bigserial PRIMARY KEY,
  characterization_id text NOT NULL,
  rule_code           text NOT NULL,
  rule_version        text NOT NULL,
  severity            text NOT NULL,
  detail              text,
  review_status       text NOT NULL DEFAULT 'open',
  reviewed_by         text,
  reviewed_at         timestamptz
);

CREATE TABLE analysis_run (
  id              uuid PRIMARY KEY,
  question        text,
  filters         jsonb NOT NULL,
  cohorts         jsonb,
  methods         jsonb NOT NULL,               -- method + version per analysis
  dataset_version text NOT NULL,
  metrics         jsonb,
  evidence        jsonb,                        -- sample ids, tool calls
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text
);

CREATE TABLE report (
  id              text PRIMARY KEY,
  analysis_run_id uuid REFERENCES analysis_run(id),
  title           text NOT NULL,
  content         jsonb NOT NULL,               -- findings, hypotheses, limitations, items
  sources         jsonb NOT NULL,
  author          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE context_dataset (
  id          text PRIMARY KEY,
  variable    text NOT NULL,                    -- e.g. tonnes_collected, population
  geography   text NOT NULL,                    -- municipality | comarca | circuit
  period      text NOT NULL,
  source      text NOT NULL,
  unit        text NOT NULL,
  granularity text NOT NULL,
  data        jsonb NOT NULL
);

-- Roles for production: reader, analyst, administrator (row-level policies per mode/dataset).
