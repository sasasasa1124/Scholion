-- User settings: language, AI prompts, daily goal, etc.
CREATE TABLE IF NOT EXISTS user_settings (
  user_email TEXT NOT NULL,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_email, key)
);

-- Daily progress snapshots per exam per user
CREATE TABLE IF NOT EXISTS user_snapshots (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  exam_id    TEXT NOT NULL,
  ts         INTEGER NOT NULL,
  correct    INTEGER NOT NULL,
  total      INTEGER NOT NULL,
  accuracy   REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_snapshots_user_exam
  ON user_snapshots(user_email, exam_id);
