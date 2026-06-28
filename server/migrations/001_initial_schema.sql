CREATE TABLE IF NOT EXISTS parliamentarians (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  subdomain   TEXT        UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id                  UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  entra_oid           TEXT  UNIQUE NOT NULL,
  parliamentarian_id  UUID  NOT NULL REFERENCES parliamentarians(id),
  role                TEXT  NOT NULL DEFAULT 'staff'
                            CHECK (role IN ('admin', 'staff')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS submissions (
  id                  UUID        PRIMARY KEY,
  tracking_id         TEXT        UNIQUE NOT NULL,
  parliamentarian_id  UUID        NOT NULL REFERENCES parliamentarians(id),
  title               TEXT        NOT NULL,
  category            TEXT        NOT NULL
                                  CHECK (category IN ('infrastructure', 'health', 'education', 'security', 'other')),
  description         TEXT        NOT NULL,
  contact_email       TEXT,
  status              TEXT        NOT NULL DEFAULT 'new'
                                  CHECK (status IN ('new', 'in_review', 'resolved')),
  created_at          TIMESTAMPTZ NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL,
  public_response     TEXT,
  internal_notes      TEXT
);

CREATE INDEX IF NOT EXISTS idx_submissions_parliamentarian
  ON submissions(parliamentarian_id);

CREATE INDEX IF NOT EXISTS idx_submissions_parliamentarian_status
  ON submissions(parliamentarian_id, status);

CREATE INDEX IF NOT EXISTS idx_submissions_parliamentarian_created
  ON submissions(parliamentarian_id, created_at DESC);
