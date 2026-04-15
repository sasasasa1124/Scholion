/**
 * POST /api/admin/import
 *
 * Accepts an Excel (.xlsx/.xls) or CSV file, parses it server-side,
 * then uses the unified AI adapter (Gemini or Bedrock) to convert
 * the data into standardised exam questions and bulk-inserts into the DB.
 *
 * Streams progress as Server-Sent Events:
 *   data: { step: "upload" | "inspect" | "convert" | "saving" | "done" | "error", ...fields }
 */

import { NextRequest } from "next/server";
import { aiGenerate } from "@/lib/ai-client";
import { getDB, getNow } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getUserEmail } from "@/lib/user";
import { parseAiJsonAs } from "@/lib/ai-json";
import { ImportedQuestionsSchema } from "@/lib/ai-schemas";
import type { ImportedQuestion } from "@/lib/ai-schemas";
import { parseUploadedFile } from "@/lib/file-parser";

// ── Constants ────────────────────────────────────────────────────────────────

/** Max questions per AI call to stay within token limits */
const BATCH_SIZE = 80;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "X-Accel-Buffering": "no",
};

// ── System instruction ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a data conversion specialist for a certification quiz application.
Your task is to convert structured file data into a standardised JSON array of exam questions.

## Output Format

Respond with a JSON array ONLY (no markdown fences, no explanation):
[{"num":1,"question":"...","choices":["A. opt","B. opt","C. opt","D. opt"],"answer":["A"],"explanation":"...","source":""}]

Field rules:
- num: integer, 1-based question number
- question: full question text (no choices embedded)
- choices: string array, each starting with a letter and period, e.g. "A. Option text"
- answer: array of uppercase letters, e.g. ["A"] or ["A","C"] for multi-select
- explanation: explanation text (empty string if none)
- source: source URL or reference (empty string if none)

## Important
- Convert ALL rows — do NOT truncate or summarize
- Japanese/Chinese/Korean column headers are fine — identify by content
- Handle both embedded choices (in same cell, newline-separated) and separate choice columns
- Normalise answers: extract uppercase letters only
- Skip rows where both question and answer are empty
- If choices are not labelled with letters, assign A, B, C, D... in order`;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build {label, text} choices from the string array the agent outputs. */
function buildOptions(choices: string[]): { label: string; text: string }[] {
  return choices.map((c, i) => {
    const m = c.match(/^([A-Z])[.)]\s*([\s\S]+)$/);
    if (m) return { label: m[1], text: m[2].trim() };
    return { label: String.fromCharCode(65 + i), text: c.trim() };
  });
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const examId = (formData.get("examId") as string | null)?.trim();
  const examName = (formData.get("examName") as string | null)?.trim() || examId;
  const lang = (formData.get("lang") as string | null) ?? "ja";
  const sheetHint = (formData.get("sheetHint") as string | null)?.trim() || null;

  if (!file || !examId) {
    return new Response(JSON.stringify({ error: "file and examId are required" }), { status: 400 });
  }

  const pg = getDB();
  if (!pg) {
    return new Response(JSON.stringify({ error: "DB not available" }), { status: 503 });
  }
  const now = getNow(pg);
  const userEmail = await getUserEmail();

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (data: object) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* client disconnected */ }
      };

      try {
        // ── 1. Parse file server-side ──────────────────────────────────────
        send({ step: "upload", message: "Reading file..." });

        const parsed = await parseUploadedFile(file, sheetHint);

        if (parsed.rows.length === 0) {
          send({ step: "error", message: "File contains no data rows." });
          return controller.close();
        }

        send({
          step: "inspect",
          message: `Found ${parsed.rows.length} rows in "${parsed.sheet}" with columns: ${parsed.headers.join(", ")}`,
        });

        // ── 2. Convert via AI (batch if large) ────────────────────────────
        send({ step: "convert", message: `Converting ${parsed.rows.length} rows via AI...` });

        const allQuestions: ImportedQuestion[] = [];
        const totalRows = parsed.rows.length;
        const batches = Math.ceil(totalRows / BATCH_SIZE);

        for (let b = 0; b < batches; b++) {
          const startIdx = b * BATCH_SIZE;
          const endIdx = Math.min(startIdx + BATCH_SIZE, totalRows);
          const batchRows = parsed.rows.slice(startIdx, endIdx);

          // Build a text representation for this batch
          const batchText = buildBatchText(parsed.headers, batchRows, startIdx);

          const numOffset = allQuestions.length;
          const batchPrompt = batches > 1
            ? `Convert the following rows (${startIdx + 1}–${endIdx} of ${totalRows}) to JSON. Start numbering from ${numOffset + 1}.\n\n${batchText}`
            : `Convert all rows to JSON.\n\n${batchText}`;

          const result = await aiGenerate(batchPrompt, {
            jsonMode: true,
            systemPrompt: SYSTEM_PROMPT,
            maxTokens: 16384,
            timeoutMs: 120_000,
          });

          const { data, error } = parseAiJsonAs(result.text, ImportedQuestionsSchema);
          if (!data) {
            send({ step: "error", message: `AI validation failed (batch ${b + 1}/${batches}): ${error}` });
            return controller.close();
          }

          allQuestions.push(...data);

          if (batches > 1) {
            send({
              step: "convert",
              message: `Batch ${b + 1}/${batches} done (${data.length} questions)`,
              done: endIdx,
              total: totalRows,
            });
          }
        }

        if (allQuestions.length === 0) {
          send({ step: "error", message: "AI returned 0 questions." });
          return controller.close();
        }

        // ── 3. Bulk insert ───────────────────────────────────────────────
        send({ step: "saving", message: `Saving ${allQuestions.length} questions...`, done: 0, total: allQuestions.length });

        await pg`
          INSERT INTO exams (id, name, lang, created_by)
          VALUES (${examId}, ${examName ?? examId}, ${lang}, ${userEmail})
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, lang = EXCLUDED.lang`;

        let saved = 0;
        for (const q of allQuestions) {
          const qId = `${examId}__${q.num}`;
          const options = buildOptions(q.choices);

          await pg`
            INSERT INTO questions
              (id, exam_id, num, question_text, options, answers, explanation, source,
               explanation_sources, created_by, created_at, added_at)
            VALUES (
              ${qId}, ${examId}, ${q.num}, ${q.question},
              ${JSON.stringify(options)}, ${JSON.stringify(q.answer)},
              ${q.explanation}, ${q.source}, ${"[]"}, ${userEmail}, ${now}, ${now}
            )
            ON CONFLICT (id) DO UPDATE SET
              question_text = EXCLUDED.question_text,
              options       = EXCLUDED.options,
              answers       = EXCLUDED.answers,
              explanation   = EXCLUDED.explanation,
              source        = EXCLUDED.source`;

          saved++;
          if (saved % 20 === 0 || saved === allQuestions.length) {
            send({ step: "saving", done: saved, total: allQuestions.length });
          }
        }

        send({ step: "done", examId, count: saved });
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

// ── Batch text builder ──────────────────────────────────────────────────────

function buildBatchText(headers: string[], rows: string[][], startIdx: number): string {
  const lines: string[] = [];
  lines.push(`Columns: ${headers.join(" | ")}`);
  lines.push("");

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = headers.map((h, j) => {
      const val = (row[j] ?? "").trim();
      const display = val.length > 500 ? val.slice(0, 500) + "..." : val;
      return `${h}: ${display}`;
    });
    lines.push(`--- Row ${startIdx + i + 1} ---`);
    lines.push(cells.join("\n"));
  }

  return lines.join("\n");
}
