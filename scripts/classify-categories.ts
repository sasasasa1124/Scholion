/**
 * Classify all questions into exam categories using Claude AI.
 *
 * Usage:
 *   npm run classify:local   # update local D1
 *   npm run classify         # update remote D1
 *
 *   npx tsx scripts/classify-categories.ts [--local]
 *
 * Requires ANTHROPIC_API_KEY in environment.
 */

import Anthropic from "@anthropic-ai/sdk";
import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const isLocal = process.argv.includes("--local");
const CSV_DIR = path.join(process.cwd(), "..");
const SQL_OUT = path.join(process.cwd(), "scripts", "_categories.sql");

// ── Category definitions per exam ──────────────────────────────────────────

const EXAM_CATEGORIES: Record<string, string[]> = {
  experience_cloud_consultant_exam: [
    "Experience Cloud Basics",
    "Sharing, Visibility, and Licensing",
    "Branding, Personalization, and Content",
    "Templates and Themes",
    "User Creation and Authentication",
    "Adoption and Analytics",
    "Administration, Setup, and Configuration",
    "Customization Considerations and Limitations",
  ],
  service_cloud_consultant_exam: [
    "Industry Knowledge",
    "Implementation Strategies",
    "Service Cloud Solution Design",
    "Knowledge Management",
    "Intake and Interaction Channels",
    "Case Management",
    "Contact Center Analytics",
    "Integrations",
  ],
  plat_arch_202_exam: [
    "Application Lifecycle Management",
    "Planning",
    "System Design",
    "Building",
    "Deploying",
    "Testing",
    "Releasing",
    "Operating",
  ],
  platform_iam_architect_exam: [
    "Identity Management Concepts",
    "Accepting Third-Party Identity in Salesforce",
    "Salesforce as an Identity Provider",
    "Access Management Best Practices",
    "Salesforce Identity",
    "Community (Partner and Customer)",
  ],
  ux_designer_exam: [
    "Declarative Design",
    "Salesforce Lightning Design System (SLDS)",
    "UX Fundamentals",
    "Discovery",
    "Human-Centered Design",
    "Testing",
  ],
  mule_dev_201_exam: [
    "Explaining Application Network Basics",
    "Designing and Consuming APIs",
    "Accessing and Modifying Mule Events",
    "Structuring Mule Applications",
    "Building API Implementation Interfaces",
    "Routing Events",
    "Handling Errors",
    "Transforming Data with DataWeave",
    "Using Connectors",
    "Processing Records",
    "Debugging and Troubleshooting Mule Applications",
    "Deploying and Managing APIs and Integrations",
  ],
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

function parseChoicesText(raw: string): string {
  return raw
    .split(/\s*\|\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" | ");
}

interface QuestionRow {
  num: number;
  question: string;
  choices: string;
}

async function classifyBatch(
  client: Anthropic,
  questions: QuestionRow[],
  categories: string[]
): Promise<Record<number, string>> {
  const questionsText = questions
    .map(
      (q) =>
        `Question ${q.num}:\n${q.question}\nChoices: ${q.choices}`
    )
    .join("\n\n---\n\n");

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are classifying certification exam questions into topic categories.

Categories (choose exactly one per question):
${categories.map((c, i) => `${i + 1}. ${c}`).join("\n")}

For each question below, respond with a JSON object mapping question number to category name.
Example: {"1": "Category Name", "2": "Another Category"}

Questions:
${questionsText}

Respond with only the JSON object, no other text.`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  // Extract JSON from response (handle possible code block wrapping)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON in response: ${text}`);

  const raw = JSON.parse(jsonMatch[0]) as Record<string, string>;
  const result: Record<number, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const num = parseInt(k, 10);
    // Validate category
    const matched = categories.find(
      (c) => c.toLowerCase() === v.toLowerCase()
    ) ?? categories.find(
      (c) => c.toLowerCase().includes(v.toLowerCase()) || v.toLowerCase().includes(c.toLowerCase())
    );
    if (matched) result[num] = matched;
  }
  return result;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  const sqlLines: string[] = [];
  const BATCH_SIZE = 25;

  for (const [baseExamId, categories] of Object.entries(EXAM_CATEGORIES)) {
    // Read the EN CSV for classification (has English question text)
    const enFile = `${baseExamId}_en.csv`;
    const enPath = path.join(CSV_DIR, enFile);

    if (!fs.existsSync(enPath)) {
      console.warn(`  [skip] ${enFile} not found`);
      continue;
    }

    console.log(`\nProcessing ${baseExamId}...`);
    const content = fs.readFileSync(enPath, "utf-8");
    const records = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];

    const questions: QuestionRow[] = records.map((row, i) => ({
      num: parseInt(row["#"] ?? String(i + 1), 10),
      question: (row["question"] ?? row["質問"] ?? "").slice(0, 300),
      choices: parseChoicesText(row["choices"] ?? row["選択肢"] ?? "").slice(0, 200),
    }));

    // Classify in batches
    const categoryMap: Record<number, string> = {};
    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      const batch = questions.slice(i, i + BATCH_SIZE);
      process.stdout.write(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(questions.length / BATCH_SIZE)}...`);
      try {
        const result = await classifyBatch(client, batch, categories);
        Object.assign(categoryMap, result);
        console.log(` done (${Object.keys(result).length}/${batch.length} classified)`);
      } catch (err) {
        console.error(` ERROR: ${err}`);
      }
      // Small delay to avoid rate limiting
      if (i + BATCH_SIZE < questions.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Generate SQL UPDATE for both JA and EN exam IDs
    const examIds = [baseExamId, `${baseExamId}_en`];
    for (const [num, category] of Object.entries(categoryMap)) {
      for (const examId of examIds) {
        const questionId = `${examId}__${num}`;
        sqlLines.push(
          `UPDATE questions SET category = '${esc(category)}' WHERE id = '${esc(questionId)}';`
        );
      }
    }

    console.log(`  ${baseExamId}: ${Object.keys(categoryMap).length}/${questions.length} questions classified`);
  }

  fs.writeFileSync(SQL_OUT, sqlLines.join("\n"), "utf-8");
  console.log(`\nSQL written to ${SQL_OUT}`);

  const localFlag = isLocal ? "--local" : "--remote";
  const cmd = `wrangler d1 execute quiz-db ${localFlag} --file=scripts/_categories.sql`;
  console.log(`Running: ${cmd}\n`);
  execSync(cmd, { stdio: "inherit", cwd: process.cwd() });

  fs.unlinkSync(SQL_OUT);
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
