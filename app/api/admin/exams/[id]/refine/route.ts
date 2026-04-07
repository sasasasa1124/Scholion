export const runtime = 'edge';
import { NextRequest } from "next/server";
import { getDB, getNow } from "@/lib/db";
import { DEFAULT_REFINE_PROMPT } from "@/lib/types";
import type { Choice } from "@/lib/types";
import { requireAdmin } from "@/lib/auth";
import { parseAiJsonAs } from "@/lib/ai-json";
import { AiRefineResponseSchema } from "@/lib/ai-schemas";
import { aiGenerate } from "@/lib/ai-client";

interface QuestionRow {
  id: string;
  question_text: string;
  options: string;
  answers: string;
  refined_at: string | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id: examId } = await params;
  let userPrompt: string | undefined;
  let forceRefine = false;
  try {
    const body = await req.json() as { userPrompt?: string; forceRefine?: boolean };
    userPrompt = body.userPrompt;
    forceRefine = body.forceRefine ?? false;
  } catch { /* no body is fine */ }

  const pg = getDB();
  if (!pg) {
    return new Response(JSON.stringify({ error: "DB not available" }), { status: 503 });
  }
  const now = getNow(pg);

  const allRows = await pg<QuestionRow[]>`SELECT id, question_text, options, answers, refined_at FROM questions WHERE exam_id = ${examId} AND question_text != '' ORDER BY num ASC`;
  const candidates = forceRefine ? allRows : allRows.filter((r) => !r.refined_at);
  const skipped = allRows.length - candidates.length;
  const total = candidates.length;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (data: object) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // ignore — client disconnected; DB writes must continue
        }
      };
      const ping = () => {
        try { controller.enqueue(enc.encode(": ping\n\n")); } catch { /* disconnected */ }
      };
      // Heartbeat every 20s to prevent App Runner ALB from dropping idle SSE connections
      const heartbeat = setInterval(ping, 20_000);

      if (total === 0) {
        send({ done: 0, total: 0, skipped, refined: 0, failed: 0 });
        clearInterval(heartbeat);
        controller.close();
        return;
      }

      send({ done: 0, total, skipped, failed: 0 });

      let done = 0;
      let refined = 0;
      let failed = 0;

      try {
        for (const q of candidates) {
          try {
            const choices = JSON.parse(q.options) as Choice[];
            const answers = JSON.parse(q.answers ?? "[]") as string[];
            const choicesText = choices.map((c: Choice) => `${c.label}. ${c.text}`).join("\n");
            const answersText = answers.join(", ");
            const template = userPrompt || DEFAULT_REFINE_PROMPT;
            const prompt = template
              .replace("{question}", q.question_text)
              .replace("{choices}", choicesText)
              .replace("{answers}", answersText);

            const { text: raw } = await aiGenerate(prompt, { jsonMode: true, useSearch: true });
            const { data: result, error: parseError } = parseAiJsonAs(raw, AiRefineResponseSchema);
            if (parseError || !result) throw new Error(parseError ?? "parse failed");

            const questionChanged = result.question !== q.question_text;
            const choicesChanged = result.choices.some((c: Choice) => {
              const orig = choices.find((o: Choice) => o.label === c.label);
              return orig ? orig.text !== c.text : false;
            });

            if (questionChanged || choicesChanged) {
              await pg`UPDATE questions SET question_text = ${result.question}, options = ${JSON.stringify(result.choices)}, version = version + 1, refined_at = ${now}, updated_at = ${now} WHERE id = ${q.id}`;
              refined++;
            } else {
              await pg`UPDATE questions SET refined_at = ${now} WHERE id = ${q.id}`;
            }
          } catch { failed++; }

          done++;
          send({ done, total, skipped, refined, failed });
        }

        send({ done: total, total, skipped, refined, failed });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        send({ error: msg });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
