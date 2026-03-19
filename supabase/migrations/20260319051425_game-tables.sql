-- ============================================================
-- PLAYERS (lightweight, cookie-based identity)
-- ============================================================
CREATE TABLE players (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   TEXT UNIQUE NOT NULL,       -- UUID stored in browser cookie/localStorage
  nickname    TEXT NOT NULL,
  avatar      TEXT NOT NULL,              -- emoji or avatar key
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- GAME SESSIONS
-- ============================================================
CREATE TABLE game_sessions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id               UUID NOT NULL REFERENCES players(id),
  seed_id                 TEXT NOT NULL REFERENCES seeds(id),
  -- Profile inputs
  starting_portfolio      NUMERIC NOT NULL,
  monthly_contribution    NUMERIC NOT NULL,
  -- Results (filled at session end)
  final_portfolio         NUMERIC,
  final_retirement_prob   FLOAT,
  benchmark_final         NUMERIC,
  behavioral_profile      TEXT,           -- 'panic_seller', 'diamond_hands', etc.
  composite_score         FLOAT,
  -- Summary stats
  total_rebalances        INT,
  panic_rebalances        INT,
  cash_heavy_weeks        INT,
  max_drawdown_pct        FLOAT,
  -- Chain state for life events
  chain_state             JSONB,
  -- Meta
  duration_seconds        INT,
  completed               BOOLEAN DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT now(),
  completed_at            TIMESTAMPTZ
);

CREATE INDEX idx_sessions_player ON game_sessions(player_id);
CREATE INDEX idx_sessions_seed ON game_sessions(seed_id);
CREATE INDEX idx_sessions_score ON game_sessions(composite_score DESC) WHERE completed = true;

-- ============================================================
-- PORTFOLIO ALLOCATIONS (initial + every rebalance snapshot)
-- ============================================================
CREATE TABLE portfolio_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  week_tick   INT NOT NULL,               -- 0 = initial allocation before sim starts
  is_initial  BOOLEAN DEFAULT false,
  allocations JSONB NOT NULL,             -- [{"assetId":"smi","pct":30,"value":3000}, ...]
  total_value NUMERIC NOT NULL,
  trigger     TEXT NOT NULL,              -- 'initial', 'manual_rebalance', 'life_event'
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_snapshots_session ON portfolio_snapshots(session_id, week_tick);

-- ============================================================
-- LIFE EVENT CHOICES (for social proof)
-- ============================================================
CREATE TABLE event_choices (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  event_key               TEXT NOT NULL,  -- e.g. 'career.opportunity', 'crisis.crash_news'
  chain                   TEXT NOT NULL,  -- 'family', 'career', 'crisis'
  chosen                  TEXT NOT NULL CHECK (chosen IN ('a', 'b')),
  portfolio_at_choice     NUMERIC,
  created_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_event_choices_event ON event_choices(event_key);

-- ============================================================
-- EVENT CHOICE STATS (aggregated for fast social proof reads)
-- Updated via trigger or at session end
-- ============================================================
CREATE TABLE event_choice_stats (
  event_key           TEXT PRIMARY KEY,
  total_choices       INT DEFAULT 0,
  option_a_count      INT DEFAULT 0,
  option_b_count      INT DEFAULT 0,
  option_a_avg_final_prob FLOAT,
  option_b_avg_final_prob FLOAT,
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Trigger to auto-update stats when a choice is inserted
CREATE OR REPLACE FUNCTION update_event_choice_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO event_choice_stats (event_key, total_choices, option_a_count, option_b_count)
  VALUES (
    NEW.event_key,
    1,
    CASE WHEN NEW.chosen = 'a' THEN 1 ELSE 0 END,
    CASE WHEN NEW.chosen = 'b' THEN 1 ELSE 0 END
  )
  ON CONFLICT (event_key) DO UPDATE SET
    total_choices = event_choice_stats.total_choices + 1,
    option_a_count = event_choice_stats.option_a_count + CASE WHEN NEW.chosen = 'a' THEN 1 ELSE 0 END,
    option_b_count = event_choice_stats.option_b_count + CASE WHEN NEW.chosen = 'b' THEN 1 ELSE 0 END,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_event_choice_stats
AFTER INSERT ON event_choices
FOR EACH ROW EXECUTE FUNCTION update_event_choice_stats();

-- ============================================================
-- LEADERBOARD VIEW
-- ============================================================
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  gs.id AS session_id,
  p.nickname,
  p.avatar,
  gs.seed_id,
  gs.final_portfolio,
  gs.composite_score,
  gs.behavioral_profile,
  gs.duration_seconds,
  gs.completed_at
FROM game_sessions gs
JOIN players p ON gs.player_id = p.id
WHERE gs.completed = true
ORDER BY gs.composite_score DESC;

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_choice_stats ENABLE ROW LEVEL SECURITY;

-- Players: anyone can create, read own
CREATE POLICY "Anyone can create player" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read players" ON players FOR SELECT USING (true);

-- Sessions: anyone can create, read all (for leaderboard)
CREATE POLICY "Anyone can create session" ON game_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update own session" ON game_sessions FOR UPDATE USING (true);
CREATE POLICY "Public read sessions" ON game_sessions FOR SELECT USING (true);

-- Snapshots: anyone can insert, read all
CREATE POLICY "Anyone can insert snapshot" ON portfolio_snapshots FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read snapshots" ON portfolio_snapshots FOR SELECT USING (true);

-- Event choices: anyone can insert, read all
CREATE POLICY "Anyone can insert choice" ON event_choices FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read choices" ON event_choices FOR SELECT USING (true);

-- Event stats: public read, insert/update via trigger (service role)
CREATE POLICY "Public read event stats" ON event_choice_stats FOR SELECT USING (true);
CREATE POLICY "Service can manage stats" ON event_choice_stats FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;