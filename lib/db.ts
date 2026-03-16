import { getRequestContext } from "@cloudflare/next-on-pages";
import type { Choice, ExamMeta, Question, QuestionHistoryEntry, QuizStats } from "./types";

interface Env {
  DB: D1Database;
}

function getDB(): D1Database {
  return getRequestContext<Env>().env.DB;
}

// ── Exam list ──────────────────────────────────────────────────────────────

export async function getExamList(): Promise<ExamMeta[]> {
  const db = getDB();
  const result = await db
    .prepare(
      `SELECT e.id, e.name, e.lang, COUNT(q.id) AS question_count
       FROM exams e
       LEFT JOIN questions q ON q.exam_id = e.id
       GROUP BY e.id
       ORDER BY e.lang ASC, e.name ASC`
    )
    .all<{ id: string; name: string; lang: string; question_count: number }>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    language: row.lang as "ja" | "en",
    questionCount: row.question_count,
  }));
}

// ── Questions ──────────────────────────────────────────────────────────────

export async function getQuestions(examId: string): Promise<Question[]> {
  const db = getDB();
  const result = await db
    .prepare(
      `SELECT id, num, question_text, options, answers, explanation, source, is_duplicate, version
       FROM questions
       WHERE exam_id = ?
       ORDER BY num ASC`
    )
    .bind(examId)
    .all<{
      id: string;
      num: number;
      question_text: string;
      options: string;
      answers: string;
      explanation: string;
      source: string;
      is_duplicate: number;
      version: number;
    }>();

  return (result.results ?? []).map((row) => {
    const choices: Choice[] = JSON.parse(row.options);
    const answers: string[] = JSON.parse(row.answers);
    return {
      id: row.num,
      dbId: row.id,
      question: row.question_text,
      choices,
      answers,
      explanation: row.explanation ?? "",
      source: row.source ?? "",
      isDuplicate: row.is_duplicate === 1,
      choiceCount: choices.length,
      isMultiple: answers.length > 1,
      version: row.version,
    };
  });
}

export async function getQuestionById(id: string): Promise<Question | null> {
  const db = getDB();
  const row = await db
    .prepare(
      `SELECT id, exam_id, num, question_text, options, answers, explanation, source, is_duplicate, version
       FROM questions WHERE id = ?`
    )
    .bind(id)
    .first<{
      id: string;
      exam_id: string;
      num: number;
      question_text: string;
      options: string;
      answers: string;
      explanation: string;
      source: string;
      is_duplicate: number;
      version: number;
    }>();

  if (!row) return null;
  const choices: Choice[] = JSON.parse(row.options);
  const answers: string[] = JSON.parse(row.answers);
  return {
    id: row.num,
    dbId: row.id,
    question: row.question_text,
    choices,
    answers,
    explanation: row.explanation ?? "",
    source: row.source ?? "",
    isDuplicate: row.is_duplicate === 1,
    choiceCount: choices.length,
    isMultiple: answers.length > 1,
    version: row.version,
  };
}

// ── Question edit ──────────────────────────────────────────────────────────

export interface QuestionUpdate {
  question_text: string;
  options: Choice[];
  answers: string[];
  explanation: string;
}

export async function updateQuestion(
  id: string,
  data: QuestionUpdate,
  changedBy: string
): Promise<void> {
  const db = getDB();

  // Save current version to history first
  const current = await db
    .prepare(
      `SELECT question_text, options, answers, explanation, version FROM questions WHERE id = ?`
    )
    .bind(id)
    .first<{
      question_text: string;
      options: string;
      answers: string;
      explanation: string;
      version: number;
    }>();

  if (!current) throw new Error(`Question ${id} not found`);

  await db
    .prepare(
      `INSERT INTO question_history (question_id, question_text, options, answers, explanation, version, changed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      current.question_text,
      current.options,
      current.answers,
      current.explanation,
      current.version,
      changedBy
    )
    .run();

  // Update question to new version
  await db
    .prepare(
      `UPDATE questions
       SET question_text = ?, options = ?, answers = ?, explanation = ?,
           version = version + 1, updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(
      data.question_text,
      JSON.stringify(data.options),
      JSON.stringify(data.answers),
      data.explanation,
      id
    )
    .run();
}

export async function getQuestionHistory(questionId: string): Promise<QuestionHistoryEntry[]> {
  const db = getDB();
  const result = await db
    .prepare(
      `SELECT id, question_id, question_text, options, answers, explanation, version, changed_at, changed_by
       FROM question_history
       WHERE question_id = ?
       ORDER BY version DESC`
    )
    .bind(questionId)
    .all<{
      id: number;
      question_id: string;
      question_text: string;
      options: string;
      answers: string;
      explanation: string;
      version: number;
      changed_at: string;
      changed_by: string | null;
    }>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    questionId: row.question_id,
    questionText: row.question_text,
    options: JSON.parse(row.options) as Choice[],
    answers: JSON.parse(row.answers) as string[],
    explanation: row.explanation ?? "",
    version: row.version,
    changedAt: row.changed_at,
    changedBy: row.changed_by,
  }));
}

// ── Scores ──────────────────────────────────────────────────────────────────

export async function getScores(userEmail: string, examId: string): Promise<QuizStats> {
  const db = getDB();
  const prefix = `${examId}__`;
  const result = await db
    .prepare(
      `SELECT question_id, last_correct FROM scores
       WHERE user_email = ? AND question_id LIKE ?`
    )
    .bind(userEmail, `${prefix}%`)
    .all<{ question_id: string; last_correct: number }>();

  const stats: QuizStats = {};
  for (const row of result.results ?? []) {
    const num = row.question_id.slice(prefix.length);
    stats[num] = row.last_correct as 0 | 1;
  }
  return stats;
}

export async function saveScore(
  userEmail: string,
  examId: string,
  questionNum: number,
  correct: boolean
): Promise<void> {
  const db = getDB();
  const questionId = `${examId}__${questionNum}`;
  const lastCorrect = correct ? 1 : 0;
  const correctDelta = correct ? 1 : 0;

  await db
    .prepare(
      `INSERT INTO scores (user_email, question_id, last_correct, attempts, correct_count, updated_at)
       VALUES (?, ?, ?, 1, ?, datetime('now'))
       ON CONFLICT(user_email, question_id) DO UPDATE SET
         last_correct  = excluded.last_correct,
         attempts      = attempts + 1,
         correct_count = correct_count + excluded.correct_count,
         updated_at    = excluded.updated_at`
    )
    .bind(userEmail, questionId, lastCorrect, correctDelta)
    .run();
}
