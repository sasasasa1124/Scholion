/**
 * Convert Excel files to quiz_template.csv format.
 *
 * Usage:
 *   npx tsx scripts/xlsx-to-csv.ts
 *
 * Reads Excel files from project directory and outputs CSV files
 * in quiz template format (duplicate,#,question,choices,answer,explanation,source).
 */

import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(__dirname, "..");

const HEADER = "duplicate,#,question,choices,answer,explanation,source";

function parseQuestionAndChoices(cellText: string | number | undefined): {
  question: string;
  choices: string;
} {
  const text = String(cellText ?? "").trim();
  const parts = text.split(/\n\n/);
  const question = parts[0]?.trim() ?? "";
  const choicesBlock = parts[1] ?? "";
  const choiceLines = choicesBlock
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const choices = choiceLines.join(" | ");
  return { question, choices };
}

function normalizeAnswer(raw: string | number | undefined): string {
  const s = String(raw ?? "").trim();
  return s
    .split(/[,\s]+/)
    .map((x) => x.trim().toUpperCase())
    .filter((x) => /^[A-Z]$/.test(x))
    .join(",");
}

function escapeCSV(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

interface SheetConfig {
  xlsxFile: string;
  sheetName: string;
  outputId: string;
  numCol: number;
  duplicateCol: number;
  questionCol: number;
  choicesCol?: number;
  answerCol: number;
  explanationCol: number;
  sourceCol: number;
  headerRow: number;
}

const CONFIGS: SheetConfig[] = [
  // Application Architect
  {
    xlsxFile: "Application Architect_v1.xlsx",
    sheetName: "02_Data",
    outputId: "Salesforce認定PlatformDataアーキテクト",
    numCol: 1,
    duplicateCol: 2,
    questionCol: 4,
    answerCol: 5,
    explanationCol: 6,
    sourceCol: 7,
    headerRow: 1,
  },
  {
    xlsxFile: "Application Architect_v1.xlsx",
    sheetName: "01_Integration",
    outputId: "Salesforce認定PlatformIntegrationアーキテクト",
    numCol: 2,
    duplicateCol: -1,
    questionCol: 4,
    answerCol: 5,
    explanationCol: 6,
    sourceCol: 8,
    headerRow: 1,
  },
  {
    xlsxFile: "Application Architect_v1.xlsx",
    sheetName: "03_S&V",
    outputId: "Salesforce認定PlatformSharingAndVisibilityアーキテクト",
    numCol: 2,
    duplicateCol: 0,
    questionCol: 4,
    answerCol: 5,
    explanationCol: 6,
    sourceCol: -1,
    headerRow: 1,
  },
  // Data Cloud Consultant
  {
    xlsxFile: "DataCloudConsultant_v3.xlsx",
    sheetName: "02_問題",
    outputId: "Salesforce認定DataCloudコンサルタント",
    numCol: 1,
    duplicateCol: -1,
    questionCol: 4,
    answerCol: 5,
    explanationCol: 6,
    sourceCol: 9,
    headerRow: 1,
  },
  // Sales Cloud Consultant
  {
    xlsxFile: "認定Sales Cloudコンサルタント_vKSS.xlsx",
    sheetName: "Sheet1",
    outputId: "Salesforce認定SalesCloudコンサルタント",
    numCol: 2,
    duplicateCol: 0,
    questionCol: 3,
    answerCol: 4,
    explanationCol: 5,
    sourceCol: 6,
    headerRow: 1,
  },
  // Service Cloud Consultant
  {
    xlsxFile: "認定Service Cloudコンサルタント_vKSS.xlsx",
    sheetName: "Sheet1",
    outputId: "Salesforce認定ServiceCloudコンサルタント",
    numCol: 2,
    duplicateCol: 0,
    questionCol: 3,
    answerCol: 4,
    explanationCol: 5,
    sourceCol: 6,
    headerRow: 1,
  },
  // Advanced Administrator JPN
  {
    xlsxFile: "Copy of Advanced-Administrator-JPN試験.xlsx",
    sheetName: "Sheet1",
    outputId: "Salesforce認定Platformアドミニストレーター上級",
    numCol: 2,
    duplicateCol: 3,
    questionCol: 5,
    answerCol: 6,
    explanationCol: 7,
    sourceCol: 8,
    headerRow: 1,
  },
  // Admin composite (Question and Choices in separate columns)
  {
    xlsxFile: "Copy of Admin cert study notes - composite of Salesforce practice tests.xlsx",
    sheetName: "Composite practice test",
    outputId: "Salesforce認定Platformアドミニストレーター",
    numCol: -1,
    duplicateCol: -1,
    questionCol: 0,
    choicesCol: 1,
    answerCol: 2,
    explanationCol: 3,
    sourceCol: -1,
    headerRow: 0,
  },
  // Copy of 認定Sales Cloud (duplicate of vKSS, different version)
  {
    xlsxFile: "Copy of 認定Sales Cloudコンサルタント（JPY 2024.12.12&2025.7.11） - Sheet1.xlsx",
    sheetName: "Copy of 認定Sales Cloudコンサルタント（JP",
    outputId: "Salesforce認定SalesCloudコンサルタント_v2",
    numCol: 2,
    duplicateCol: 0,
    questionCol: 3,
    answerCol: 4,
    explanationCol: 5,
    sourceCol: 6,
    headerRow: 0,
  },
];

function processSheet(
  workbook: XLSX.WorkBook,
  config: SheetConfig
): string[] {
  const sheet = workbook.Sheets[config.sheetName];
  if (!sheet) {
    console.warn(`Sheet "${config.sheetName}" not found, skipping`);
    return [];
  }
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as (string | number)[][];

  const lines: string[] = [HEADER];
  const dataStart = config.headerRow + 1;
  let autoNum = 0;

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const get = (col: number) =>
      col >= 0 && col < row.length ? row[col] : undefined;

    let question: string;
    let choices: string;

    if (config.choicesCol != null) {
      const qRaw = get(config.questionCol);
      const cRaw = get(config.choicesCol);
      if (!qRaw || !cRaw || String(qRaw).trim() === "" || String(cRaw).trim() === "") {
        continue;
      }
      question = String(qRaw).trim();
      const choiceLines = String(cRaw)
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      choices = choiceLines.join(" | ");
    } else {
      const questionAndChoicesRaw = get(config.questionCol);
      if (!questionAndChoicesRaw || String(questionAndChoicesRaw).trim() === "") {
        continue;
      }
      const parsed = parseQuestionAndChoices(questionAndChoicesRaw);
      question = parsed.question;
      choices = parsed.choices;
    }

    const num =
      config.numCol >= 0
        ? get(config.numCol)
        : ++autoNum;
    const numVal =
      num !== undefined && num !== null && num !== ""
        ? String(Number(num) === Number(num) ? Math.round(Number(num)) : num)
        : String(autoNum);
    const duplicate =
      config.duplicateCol >= 0 ? String(get(config.duplicateCol) ?? "").trim() : "";
    const answer = normalizeAnswer(get(config.answerCol));
    const explanation = String(get(config.explanationCol) ?? "").trim();
    const source =
      config.sourceCol >= 0 ? String(get(config.sourceCol) ?? "").trim() : "";

    if (!answer) continue;

    const csvRow = [
      duplicate,
      numVal,
      escapeCSV(question),
      escapeCSV(choices),
      escapeCSV(answer),
      escapeCSV(explanation),
      escapeCSV(source),
    ].join(",");
    lines.push(csvRow);
  }

  return lines;
}

function main() {
  const byFile = new Map<string, SheetConfig[]>();
  for (const config of CONFIGS) {
    const list = byFile.get(config.xlsxFile) ?? [];
    list.push(config);
    byFile.set(config.xlsxFile, list);
  }

  for (const [xlsxFile, configs] of byFile) {
    const xlsxPath = path.join(PROJECT_DIR, xlsxFile);
    if (!fs.existsSync(xlsxPath)) {
      console.warn(`Excel file not found: ${xlsxFile}, skipping`);
      continue;
    }
    const workbook = XLSX.readFile(xlsxPath, { type: "file", cellDates: false });
    for (const config of configs) {
      const lines = processSheet(workbook, config);
      if (lines.length <= 1) {
        console.warn(`No data for ${config.xlsxFile} / ${config.sheetName}, skipping`);
        continue;
      }
      const outPath = path.join(PROJECT_DIR, `${config.outputId}.csv`);
      fs.writeFileSync(outPath, lines.join("\n"), "utf-8");
      console.log(`Wrote ${outPath} (${lines.length - 1} questions)`);
    }
  }
}

main();
