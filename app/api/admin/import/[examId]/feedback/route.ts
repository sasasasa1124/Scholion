/**
 * POST /api/admin/import/[examId]/feedback
 *
 * Accept a free-text feedback message about an already-imported exam.
 * Fetches current questions from the DB, passes them to the AI adapter
 * (Gemini or Bedrock), and applies the resulting fix list back to the DB.
 *
 * Streams progress as Server-Sent Events:
 *   data: { step: "analyzing" | "fixing" | "done" | "error", ...fields }
 */

import { NextRequest } from "next/server";
import { aiGenerate } from "@/lib/ai-client";
import { getDB, getNow } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { parseAiJsonAs } from "@/lib/ai-json";
import { FeedbackFixesSchema } from "@/lib/ai-schemas";
import type { FeedbackFix } from "@/lib/ai-schemas";

// ── Constants ────────────────────────────────────────────────────────────────

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "X-Accel-Buffering": "no",
};

// ── System instruction ───────────────────────────────────────────────────────

const FEEDBACK_SYSTEM_PROMPT = `You are reviewing already-imported exam questions and applying user corrections.

You will receive the current question data as JSON and a user feedback message describing what needs to be fixed.

## Your task

Analyze the patterns described in the feedback, identify all affected questions,
and output a JSON array of fixes ONLY (no markdown fences, no explanation).

## Fix format

Each fix is a JSON object:
- id: the question ID in the form "examId__N"
- field: one of "question_text", "options", "answers", "explanation", "source"
- value: the new value as a string
  - For "options": a JSON string of [{label:"A",text:"..."}, ...] — e.g. '[{"label":"A","text":"Option A"},{"label":"B","text":"Option B"}]'
  - For "answers": a JSON string of uppercase letters — e.g. '["A","C"]'
  - For all others: plain text

## Important
- Apply the fix to ALL affected questions, not just the sample shown
- If no fixes are needed, output an empty array: []`;

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { examId } = await params;
  const { message } = await req.json() as { message: string };

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "message is required" }), { status: 400 });
  }

  const pg = getDB();
  if (!pg) {
    return new Response(JSON.stringify({ error: "DB not available" }), { status: 503 });
  }
  const now = getNow(pg);

  // Fetch current questions from DB
  type QuestionRow = {
    id: string;
    num: number;
    question_text: string;
    options: string;
    answers: string;
    explanation: string;
    source: string;
  };

  const rows = await pg<QuestionRow[]>`
    SELECT id, num, question_text, options, answers, explanation, source
    FROM questions WHERE exam_id = ${examId} ORDER BY num ASC`;

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ error: `No questions found for exam: ${examId}` }), { status: 404 });
  }

  // Build context for the AI
  const questionsForAi = rows.map((r) => ({
    id: r.id,
    num: r.num,
    question: r.question_text,
    choices: (() => { try { return JSON.parse(r.options); } catch { return []; } })(),
    answers: (() => { try { return JSON.parse(r.answers); } catch { return []; } })(),
    explanation: r.explanation,
    source: r.source,
  }));

  const prompt = `Exam: ${examId}
Total questions: ${rows.length}

Current questions (JSON):
${JSON.stringify(questionsForAi, null, 2)}

User feedback: ${message}

Output the complete fix list as a JSON array.`;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (data: object) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* client disconnected */ }
      };

      try {
        send({ step: "analyzing", message: "Analyzing feedback..." });

        const result = await aiGenerate(prompt, {
          jsonMode: true,
          systemPrompt: FEEDBACK_SYSTEM_PROMPT,
          maxTokens: 16384,
          timeoutMs: 120_000,
        });

        const { data: fixes, error } = parseAiJsonAs(result.text, FeedbackFixesSchema);
        if (!fixes) {
          send({ step: "error", message: `Fix validation failed: ${error}` });
          return controller.close();
        }

        if (fixes.length === 0) {
          send({ step: "done", fixed: 0, message: "No fixes were generated." });
          return controller.close();
        }

        // Apply fixes to DB
        send({ step: "fixing", total: fixes.length, done: 0 });
        let fixed = 0;

        for (const fix of fixes) {
          try {
            if (!fix.id.startsWith(`${examId}__`)) continue;

            if (fix.field === "question_text") {
              await pg`UPDATE questions SET question_text = ${fix.value}, updated_at = ${now} WHERE id = ${fix.id}`;
            } else if (fix.field === "options") {
              await pg`UPDATE questions SET options = ${fix.value}, updated_at = ${now} WHERE id = ${fix.id}`;
            } else if (fix.field === "answers") {
              await pg`UPDATE questions SET answers = ${fix.value}, updated_at = ${now} WHERE id = ${fix.id}`;
            } else if (fix.field === "explanation") {
              await pg`UPDATE questions SET explanation = ${fix.value}, updated_at = ${now} WHERE id = ${fix.id}`;
            } else if (fix.field === "source") {
              await pg`UPDATE questions SET source = ${fix.value}, updated_at = ${now} WHERE id = ${fix.id}`;
            }

            fixed++;
            if (fixed % 10 === 0 || fixed === fixes.length) {
              send({ step: "fixing", done: fixed, total: fixes.length });
            }
          } catch {
            // skip individual failures
          }
        }

        send({ step: "done", fixed });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        send({ step: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
