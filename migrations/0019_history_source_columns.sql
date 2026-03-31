-- Add source and explanation_sources to question_history for complete version tracking
ALTER TABLE question_history ADD COLUMN source TEXT NOT NULL DEFAULT '';
ALTER TABLE question_history ADD COLUMN explanation_sources TEXT NOT NULL DEFAULT '[]';
