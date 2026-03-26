CREATE TABLE tts_cache (
  text_hash TEXT PRIMARY KEY,
  wav_data  TEXT NOT NULL,
  model     TEXT NOT NULL,
  voice     TEXT NOT NULL,
  created_at TEXT NOT NULL
);
