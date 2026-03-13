import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";
import type { Choice, ExamMeta, Question } from "./types";

const CSV_DIR = path.join(process.cwd(), "..");

const EXAM_NAMES: Record<string, string> = {
  experience_cloud_consultant_exam: "Experience Cloud Consultant",
  mule_dev_201_exam: "MuleSoft Developer I (DEV201)",
  plat_arch_202_exam: "Platform App Builder / Architect 202",
  platform_iam_architect_exam: "Platform Identity & Access Mgmt Architect",
  service_cloud_consultant_exam: "Service Cloud Consultant",
  ux_designer_exam: "UX Designer",
};

// Detect language from parsed CSV records.
// Priority: 1) column header names  2) character-code majority vote across question text
export function detectLanguage(records: Record<string, string>[]): "ja" | "en" {
  if (records.length === 0) return "ja";

  // 1. Column header check — most reliable signal
  const cols = Object.keys(records[0]);
  if (cols.includes("質問")) return "ja";
  if (cols.includes("question")) return "en";

  // 2. Character-code majority vote across all rows
  const jaRe = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]/g;
  const enRe = /[A-Za-z]/g;

  let jaQ = 0, enQ = 0;
  for (const row of records) {
    const text = Object.values(row).join(" ");
    const ja = (text.match(jaRe) ?? []).length;
    const en = (text.match(enRe) ?? []).length;
    if (ja > en) jaQ++; else enQ++;
  }
  return jaQ >= enQ ? "ja" : "en";
}

// Parse "A. some text | B. other text" (or newline-separated) into Choice[]
function parseChoices(raw: string): Choice[] {
  // Split on " | " or newline — supports both formats
  const parts = raw.split(/\n|\s*\|\s*/).filter((p) => p.trim());
  const choices: Choice[] = [];

  for (const part of parts) {
    // Match label like "A.", "B.", "A)", "B)" etc.
    const match = part.match(/^([A-Z])[.)]\s*([\s\S]+)$/);
    if (match) {
      choices.push({ label: match[1], text: match[2].trim() });
    } else if (part.trim()) {
      // fallback: treat the whole thing as text
      choices.push({ label: String.fromCharCode(65 + choices.length), text: part.trim() });
    }
  }
  return choices;
}

// Parse answer string "A,C,E" or "B" into string[]
function parseAnswers(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]$/.test(s));
}

export function getExamList(): ExamMeta[] {
  const files = fs.readdirSync(CSV_DIR).filter((f) => f.endsWith(".csv"));
  const metas: ExamMeta[] = [];

  for (const file of files) {
    const id = file.replace(".csv", "");
    // Strip known _en suffix for display name lookup, but don't rely on it for language
    const baseName = id.endsWith("_en") ? id.slice(0, -3) : id;
    const displayName = EXAM_NAMES[baseName] ?? baseName;

    try {
      const content = fs.readFileSync(path.join(CSV_DIR, file), "utf-8");
      const records = parse(content, { columns: true, skip_empty_lines: true });
      const language = detectLanguage(records as Record<string, string>[]);
      metas.push({
        id,
        name: displayName,
        language,
        questionCount: records.length,
      });
    } catch {
      // skip malformed CSVs
    }
  }

  // Sort: JA first, then by name
  return metas.sort((a, b) => {
    if (a.language !== b.language) return a.language === "ja" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function getQuestions(examId: string): Question[] {
  const filePath = path.join(CSV_DIR, `${examId}.csv`);
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, "utf-8");
  const records = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];

  return records.map((row): Question => {
    const choices = parseChoices(row["選択肢"] ?? row["choices"] ?? "");
    const answers = parseAnswers(row["解答"] ?? row["answer"] ?? row["answers"] ?? "");
    return {
      id: parseInt(row["#"] ?? "0", 10),
      question: row["質問"] ?? row["question"] ?? "",
      choices,
      answers,
      explanation: row["解説"] ?? row["explanation"] ?? "",
      source: row["ソース"] ?? row["source"] ?? "",
      isDuplicate: !!(row["重複"] ?? row["duplicate"] ?? "").trim(),
      choiceCount: choices.length,
      isMultiple: answers.length > 1,
    };
  });
}
