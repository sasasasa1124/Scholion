CREATE TABLE IF NOT EXISTS study_guides (
  exam_id      TEXT PRIMARY KEY,
  markdown     TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
