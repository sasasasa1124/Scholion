export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getStudyGuide, upsertStudyGuide, getSetting } from "@/lib/db";
import { getRequestContext } from "@cloudflare/next-on-pages";

interface QuestionSummary {
  question: string;
  answers: string[];
  category: string | null;
}

export async function GET(req: NextRequest) {
  const examId = req.nextUrl.searchParams.get("examId");
  if (!examId) {
    return NextResponse.json({ error: "examId required" }, { status: 400 });
  }
  const result = await getStudyGuide(examId);
  if (!result) {
    return NextResponse.json({ markdown: null, generatedAt: null });
  }
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    examId: string | null;
    examName: string;
    questions: QuestionSummary[];
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiKey = (getRequestContext() as any).env?.GEMINI_API_KEY as
    | string
    | undefined;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 }
    );
  }

  const { examId, examName, questions } = body;
  const saveToDb = examId !== null && examId !== undefined && examId !== "";

  // Group questions by category
  const byCategory = new Map<string, QuestionSummary[]>();
  for (const q of questions) {
    const cat = q.category ?? "General";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(q);
  }

  // Build condensed question list grouped by category
  const questionLines: string[] = [];
  for (const [cat, qs] of byCategory) {
    questionLines.push(`\n### Category: ${cat} (${qs.length} questions)`);
    for (const q of qs) {
      const stripped = q.question.replace(/<[^>]+>/g, "").trim();
      questionLines.push(`- Q: ${stripped} → Answers: ${q.answers.join(", ")}`);
    }
  }

  const prompt = `あなたは「${examName}」認定試験の専門家です。
以下の${questions.length}問の試験問題（カテゴリ別）を分析し、Web検索で最新情報を補完しながら、受験者向けの包括的なStudy Guideを**日本語のMarkdown形式**で作成してください。

## 出力フォーマット

# Study Guide: ${examName}

## 試験全体の要件
- 試験の概要（出題数・制限時間・合格ライン）
- 試験ドメインと出題比率（わかる範囲で）
- 重点的に学習すべき領域

## カテゴリ別 出題ポイント

各カテゴリについて以下を記述：
### {カテゴリ名}
- このカテゴリで問われるコアコンセプト
- 暗記すべき重要事項・数値・定義
- よく出る引っかけや注意ポイント
- 参考になる公式ドキュメントのURL（知っている場合）

---

以下が試験問題データです：
${questionLines.join("\n")}

重要: 問題データの分析に加え、Google Search で「${examName} 試験ガイド」「${examName} exam guide」を検索して最新の公式試験情報も参照してください。`;

  const ai = new GoogleGenAI({ apiKey });
  const model = (await getSetting("gemini_model")) ?? "gemini-2.5-flash";

  let markdown: string;
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    markdown = response.text ?? "";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Gemini API error: ${msg}` },
      { status: 502 }
    );
  }

  if (saveToDb) {
    await upsertStudyGuide(examId, markdown);
  }

  return NextResponse.json({ markdown });
}
