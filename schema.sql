-- Questions (Quiplash-style prompts)
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'quiplash'
);

-- Answers: humans + AI (Gemini / Qwen)
CREATE TABLE IF NOT EXISTS answers (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  text TEXT NOT NULL,
  source TEXT NOT NULL,        -- 'human' | 'gemini' | 'qwen'
  user_name TEXT,              -- 1-letter username for humans (or NULL)
  strategy TEXT,               -- e.g. 'gemini_v1', 'qwen_v1'
  created_at INTEGER NOT NULL,
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

-- A battle = two arbitrary answers for a question (human/AI mix)
CREATE TABLE IF NOT EXISTS battles (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  answer1_id TEXT NOT NULL,
  answer2_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (question_id) REFERENCES questions(id),
  FOREIGN KEY (answer1_id) REFERENCES answers(id),
  FOREIGN KEY (answer2_id) REFERENCES answers(id)
);

-- Votes: which answer won this battle
CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  battle_id TEXT NOT NULL,
  winner_answer_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (battle_id) REFERENCES battles(id),
  FOREIGN KEY (winner_answer_id) REFERENCES answers(id)
);

-- RL: track wins/uses per AI strategy (Gemini vs Qwen, or more later)
CREATE TABLE IF NOT EXISTS strategy_stats (
  strategy TEXT PRIMARY KEY,
  wins INTEGER NOT NULL DEFAULT 0,
  uses INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_answers_question ON answers (question_id);
CREATE INDEX IF NOT EXISTS idx_battles_question ON battles (question_id);
CREATE INDEX IF NOT EXISTS idx_votes_battle ON votes (battle_id);
