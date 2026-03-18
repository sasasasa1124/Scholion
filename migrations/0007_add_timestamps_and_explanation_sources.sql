-- Add created_at / added_at timestamps to questions
ALTER TABLE questions ADD COLUMN created_at TEXT DEFAULT (datetime('now'));
ALTER TABLE questions ADD COLUMN added_at   TEXT DEFAULT (datetime('now'));

-- Explanation sources stored as JSON array of URL strings (separate from question source)
ALTER TABLE questions ADD COLUMN explanation_sources TEXT DEFAULT '[]';
