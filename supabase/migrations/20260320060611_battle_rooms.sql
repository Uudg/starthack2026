-- ============================================================
-- Drop old battle_rooms if it exists (from previous migration)
-- ============================================================
DROP TABLE IF EXISTS battle_rooms CASCADE;

-- ============================================================
-- BATTLE ROOMS (shared timeline, N players)
-- ============================================================
CREATE TABLE battle_rooms (
  id              TEXT PRIMARY KEY,         -- 4-char code: 'A3F7'
  seed_id         TEXT NOT NULL REFERENCES seeds(id),
  created_by      UUID NOT NULL REFERENCES players(id),

  -- Room status lifecycle: waiting → countdown → playing → finished
  status          TEXT NOT NULL DEFAULT 'waiting'
                    CHECK (status IN ('waiting', 'countdown', 'playing', 'finished')),

  -- Shared game config (same for all players)
  starting_portfolio    NUMERIC NOT NULL DEFAULT 10000,
  monthly_contribution  NUMERIC NOT NULL DEFAULT 200,
  tick_speed            INT NOT NULL DEFAULT 3 CHECK (tick_speed IN (1, 3, 5)),
  event_timeout_secs    INT NOT NULL DEFAULT 15,

  -- Tick state (updated by the server tick broadcaster)
  current_tick          INT NOT NULL DEFAULT 0,
  total_ticks           INT NOT NULL DEFAULT 520,

  -- Life event pause state
  -- When a life event fires, the room enters a decision window
  active_event_key      TEXT,               -- null = no active event, 'crisis.crash_news' = waiting for choices
  event_deadline        TIMESTAMPTZ,        -- when the decision window closes

  -- Player limits
  max_players           INT NOT NULL DEFAULT 8,

  -- Timing
  countdown_start TIMESTAMPTZ,
  game_start      TIMESTAMPTZ,
  game_end        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ DEFAULT (now() + interval '30 minutes')
);

CREATE INDEX idx_rooms_status ON battle_rooms(status) WHERE status != 'finished';

-- ============================================================
-- BATTLE PLAYERS (N players per room)
-- ============================================================
CREATE TABLE battle_players (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         TEXT NOT NULL REFERENCES battle_rooms(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES players(id),
  session_id      UUID REFERENCES game_sessions(id),  -- set when game starts

  -- Lobby state
  is_ready        BOOLEAN DEFAULT false,
  allocations     JSONB,                    -- set during lobby: [{"assetId":"smi","pct":30}, ...]

  -- Live state (updated periodically during game for room leaderboard)
  current_portfolio NUMERIC DEFAULT 0,
  is_eliminated     BOOLEAN DEFAULT false,  -- portfolio dropped below threshold
  finished          BOOLEAN DEFAULT false,  -- completed the simulation

  -- Final results (set at game end)
  final_portfolio     NUMERIC,
  composite_score     FLOAT,
  behavioral_profile  TEXT,
  rank                INT,                  -- 1st, 2nd, 3rd... set when room finishes

  joined_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id, player_id)
);

CREATE INDEX idx_battle_players_room ON battle_players(room_id);

-- ============================================================
-- BATTLE EVENT CHOICES
-- Per-room event choices for live in-room social proof
-- Separate from the global event_choices table
-- ============================================================
CREATE TABLE battle_event_choices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         TEXT NOT NULL REFERENCES battle_rooms(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES players(id),
  event_key       TEXT NOT NULL,
  chosen          TEXT NOT NULL CHECK (chosen IN ('a', 'b')),
  chose_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id, player_id, event_key)   -- one choice per player per event per room
);

CREATE INDEX idx_battle_choices_room_event ON battle_event_choices(room_id, event_key);

-- ============================================================
-- Enable Realtime on tables that need live updates
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE battle_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE battle_players;
ALTER PUBLICATION supabase_realtime ADD TABLE battle_event_choices;

-- ============================================================
-- RLS — open for hackathon
-- ============================================================
ALTER TABLE battle_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_event_choices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open read rooms" ON battle_rooms FOR SELECT USING (true);
CREATE POLICY "Open insert rooms" ON battle_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Open update rooms" ON battle_rooms FOR UPDATE USING (true);

CREATE POLICY "Open read battle_players" ON battle_players FOR SELECT USING (true);
CREATE POLICY "Open insert battle_players" ON battle_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Open update battle_players" ON battle_players FOR UPDATE USING (true);

CREATE POLICY "Open read battle_choices" ON battle_event_choices FOR SELECT USING (true);
CREATE POLICY "Open insert battle_choices" ON battle_event_choices FOR INSERT WITH CHECK (true);

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;