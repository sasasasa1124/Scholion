-- Exam master
CREATE TABLE IF NOT EXISTS exams (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lang TEXT NOT NULL CHECK (lang IN ('ja', 'en'))
);

-- Questions (current version only)
-- id format: {examId}__{num}
CREATE TABLE IF NOT EXISTS questions (
  id            TEXT PRIMARY KEY,
  exam_id       TEXT NOT NULL REFERENCES exams(id),
  num           INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  options       TEXT NOT NULL,  -- JSON: Choice[]
  answers       TEXT NOT NULL,  -- JSON: string[]
  explanation   TEXT DEFAULT '',
  source        TEXT DEFAULT '',
  is_duplicate  INTEGER DEFAULT 0,
  version       INTEGER DEFAULT 1,
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id);

-- Question change history (for diff tracking)
CREATE TABLE IF NOT EXISTS question_history (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id   TEXT NOT NULL,
  question_text TEXT NOT NULL,
  options       TEXT NOT NULL,
  answers       TEXT NOT NULL,
  explanation   TEXT DEFAULT '',
  version       INTEGER NOT NULL,
  changed_at    TEXT DEFAULT (datetime('now')),
  changed_by    TEXT
);

CREATE INDEX IF NOT EXISTS idx_history_question_id ON question_history(question_id);

-- Scores per user per question
CREATE TABLE IF NOT EXISTS scores (
  user_email    TEXT NOT NULL,
  question_id   TEXT NOT NULL,  -- format: {examId}__{num}
  last_correct  INTEGER NOT NULL, -- 0 or 1
  attempts      INTEGER DEFAULT 1,
  correct_count INTEGER DEFAULT 0,
  updated_at    TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_email, question_id)
);

CREATE INDEX IF NOT EXISTS idx_scores_user_exam ON scores(user_email, question_id);
