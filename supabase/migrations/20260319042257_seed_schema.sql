-- ============================================================
-- ASSETS — static registry of available assets
-- ============================================================
CREATE TABLE assets (
  id          TEXT PRIMARY KEY,           -- e.g. 'smi', 'nestle', 'gold_chf'
  name        TEXT NOT NULL,              -- display name: 'Swiss Market Index'
  asset_class TEXT NOT NULL,              -- 'equity_index', 'stock', 'bond', 'gold'
  region      TEXT,                       -- 'CH', 'EU', 'US', 'global'
  ticker      TEXT,                       -- original ticker for reference
  description TEXT,                       -- short beginner-friendly description
  risk_level  INT CHECK (risk_level BETWEEN 1 AND 5),  -- 1=low, 5=high
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- WEEKLY_PRICES — resampled weekly prices for all assets
-- Full 20-year dataset, seeds reference ranges within this
-- ============================================================
CREATE TABLE weekly_prices (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asset_id    TEXT NOT NULL REFERENCES assets(id),
  week_index  INT NOT NULL,               -- 0-indexed week number from start of dataset
  date        DATE NOT NULL,              -- actual date of this week's close
  price       NUMERIC NOT NULL,           -- closing price in original currency
  UNIQUE(asset_id, week_index)
);

CREATE INDEX idx_weekly_prices_asset_week ON weekly_prices(asset_id, week_index);

-- ============================================================
-- SEEDS — curated 10-year game scenarios
-- ============================================================
CREATE TABLE seeds (
  id              TEXT PRIMARY KEY,        -- e.g. 'alpine-storm', 'long-summer'
  name            TEXT NOT NULL,           -- display name shown after reveal
  start_week      INT NOT NULL,           -- index into weekly_prices
  end_week        INT NOT NULL,           -- index into weekly_prices
  total_weeks     INT GENERATED ALWAYS AS (end_week - start_week) STORED,
  start_date      DATE NOT NULL,          -- actual calendar date of start
  end_date        DATE NOT NULL,          -- actual calendar date of end
  difficulty      TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  description     TEXT,                   -- internal description for devs
  reveal_title    TEXT NOT NULL,          -- "You just invested through 2006–2016"
  reveal_text     TEXT NOT NULL,          -- longer narrative for results screen
  historical_events JSONB,               -- [{week: 130, name: "2008 Financial Crisis", type: "crash"}, ...]
  crash_weeks     INT[],                  -- weeks where major crashes occur (for event pinning)
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SEED_ASSETS — which assets are available per seed
-- (allows different seeds to offer different asset menus)
-- ============================================================
CREATE TABLE seed_assets (
  seed_id     TEXT NOT NULL REFERENCES seeds(id),
  asset_id    TEXT NOT NULL REFERENCES assets(id),
  PRIMARY KEY (seed_id, asset_id)
);

-- ============================================================
-- Enable RLS but allow public read for game data
-- ============================================================
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE seeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE seed_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read assets" ON assets FOR SELECT USING (true);
CREATE POLICY "Public read weekly_prices" ON weekly_prices FOR SELECT USING (true);
CREATE POLICY "Public read seeds" ON seeds FOR SELECT USING (true);
CREATE POLICY "Public read seed_assets" ON seed_assets FOR SELECT USING (true);