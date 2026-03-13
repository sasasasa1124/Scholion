import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";
import { detectLanguage } from "@/lib/csv";

const CSV_DIR = path.join(process.cwd(), "..");

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const name = file.name.replace(/[^a-zA-Z0-9_\-. ]/g, "_");
  if (!name.endsWith(".csv")) {
    return NextResponse.json({ error: "CSV only" }, { status: 400 });
  }

  const text = await file.text();

  // Validate it's parseable CSV with expected columns
  let records: Record<string, string>[];
  try {
    records = parse(text, { columns: true, skip_empty_lines: true });
  } catch {
    return NextResponse.json({ error: "Invalid CSV" }, { status: 400 });
  }

  if (records.length === 0) {
    return NextResponse.json({ error: "Empty CSV" }, { status: 400 });
  }

  const cols = Object.keys(records[0]);
  const hasJa = cols.includes("質問") && cols.includes("選択肢") && cols.includes("解答");
  const hasEn = cols.includes("question") && cols.includes("choices") && (cols.includes("answer") || cols.includes("answers"));
  if (!hasJa && !hasEn) {
    return NextResponse.json({
      error: "CSVには 質問/選択肢/解答 (日本語) または question/choices/answer (英語) カラムが必要です"
    }, { status: 400 });
  }

  const destPath = path.join(CSV_DIR, name);
  fs.writeFileSync(destPath, text, "utf-8");

  const examId = name.replace(".csv", "");
  const language = detectLanguage(records);
  return NextResponse.json({
    exam: {
      id: examId,
      name: examId.replace(/_en$/, "").replace(/_/g, " "),
      language,
      questionCount: records.length,
    }
  });
}
