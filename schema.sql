CREATE TABLE IF NOT EXISTS jokes (
  id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  text TEXT NOT NULL,
  is_human INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS battles (
  id TEXT PRIMARY KEY,
  human_joke_id TEXT NOT NULL,
  llm_joke_id TEXT NOT NULL,
  FOREIGN KEY (human_joke_id) REFERENCES jokes(id),
  FOREIGN KEY (llm_joke_id) REFERENCES jokes(id)
);

CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  battle_id TEXT NOT NULL,
  winner_joke_id TEXT NOT NULL,
  human_is_winner INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (battle_id) REFERENCES battles(id),
  FOREIGN KEY (winner_joke_id) REFERENCES jokes(id)
);

CREATE INDEX IF NOT EXISTS idx_votes_battle ON votes (battle_id);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes (created_at);
