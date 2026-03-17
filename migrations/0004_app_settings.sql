CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- デフォルトモデル
INSERT INTO app_settings (key, value) VALUES ('gemini_model', 'gemini-2.5-flash-preview-04-17');
