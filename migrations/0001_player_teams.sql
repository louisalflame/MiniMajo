CREATE TABLE IF NOT EXISTS player_teams (
  record_id TEXT PRIMARY KEY,
  pool_version TEXT NOT NULL,
  run_id TEXT NOT NULL,
  match_level INTEGER NOT NULL CHECK(match_level BETWEEN 1 AND 1000000),
  category TEXT NOT NULL CHECK(category IN ('normal','elite','boss')),
  snapshot_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(pool_version,run_id,match_level)
);
CREATE INDEX IF NOT EXISTS player_teams_matching ON player_teams(pool_version,enabled,match_level,run_id);
