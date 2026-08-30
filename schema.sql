CREATE TABLE IF NOT EXISTS players (
  player_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 9999,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','player')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_player ON sessions(player_id);
CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_player_id TEXT NOT NULL,
  target_player_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS balance_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_id TEXT NOT NULL UNIQUE,
  player_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_balance_ledger_player ON balance_ledger(player_id,created_at DESC);

CREATE TABLE IF NOT EXISTS mahjong_games (
  game_id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('waiting','playing','finished')),
  rule_version TEXT NOT NULL DEFAULT 'JANMA_SOUL_SANMA',
  round_wind TEXT NOT NULL DEFAULT 'E',
  hand_number INTEGER NOT NULL DEFAULT 1,
  honba INTEGER NOT NULL DEFAULT 0,
  kyotaku INTEGER NOT NULL DEFAULT 0,
  dealer_seat INTEGER NOT NULL DEFAULT 0,
  turn_seat INTEGER NOT NULL DEFAULT 0,
  state_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mahjong_games_room ON mahjong_games(room_id);
CREATE TABLE IF NOT EXISTS mahjong_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  seat INTEGER NOT NULL,
  action TEXT NOT NULL,
  tile TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mahjong_actions_game ON mahjong_actions(game_id,id DESC);
