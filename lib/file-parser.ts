/**
 * Server-side file parser for Excel (.xlsx/.xls) and CSV files.
 *
 * Converts uploaded files into a structured text representation
 * suitable for passing to an LLM for question extraction.
 */

import * as XLSX from "xlsx";

export interface ParsedFile {
  /** Detected sheet name (for Excel) or "CSV" */
  sheet: string;
  /** Column headers */
  headers: string[];
  /** All data rows as string arrays */
  rows: string[][];
  /** Pre-formatted text representation for LLM consumption */
  textRepresentation: string;
}

// ── RFC 4180-compliant CSV parser (edge-compatible) ─────────────────────────

function parseCSVCells(text: string): string[][] {
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let i = 0;
  while (i <= src.length) {
    if (i === src.length || src[i] === "\n") {
      rows.push(row);
      row = [];
      i++;
    } else if (src[i] === ",") {
      row.push("");
      i++;
    } else if (src[i] === '"') {
      i++;
      let cell = "";
      while (i < src.length) {
        if (src[i] === '"' && src[i + 1] === '"') { cell += '"'; i += 2; }
        else if (src[i] === '"') { i++; break; }
        else { cell += src[i++]; }
      }
      row.push(cell);
      if (src[i] === ",") i++;
    } else {
      let cell = "";
      while (i < src.length && src[i] !== "," && src[i] !== "\n") cell += src[i++];
      row.push(cell);
      if (src[i] === ",") i++;
    }
  }
  return rows.filter(r => r.some(c => c.trim()));
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function parseUploadedFile(
  file: File,
  sheetHint?: string | null
): Promise<ParsedFile> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";

  if (ext === "csv") {
    return parseCSVFile(await file.text());
  }

  if (ext === "xlsx" || ext === "xls") {
    const buffer = await file.arrayBuffer();
    return parseExcelFile(buffer, sheetHint ?? undefined);
  }

  throw new Error(`Unsupported file type: .${ext}`);
}

function parseCSVFile(text: string): ParsedFile {
  const allRows = parseCSVCells(text);
  if (allRows.length === 0) throw new Error("CSV file is empty");

  const [headers, ...dataRows] = allRows;
  const cleaned = dataRows.map(row =>
    row.map(cell => cell.replace(/\\n/g, "\n"))
  );

  return {
    sheet: "CSV",
    headers,
    rows: cleaned,
    textRepresentation: buildTextRepresentation("CSV", headers, cleaned),
  };
}

function parseExcelFile(buffer: ArrayBuffer, sheetHint?: string): ParsedFile {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });

  const sheetName = sheetHint && workbook.SheetNames.includes(sheetHint)
    ? sheetHint
    : workbook.SheetNames[0];

  if (!sheetName) throw new Error("Excel file has no sheets");

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);

  const rawRows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as (string | number)[][];

  if (rawRows.length === 0) throw new Error("Sheet is empty");

  const headers = rawRows[0].map(String);
  const dataRows = rawRows.slice(1).map(row => row.map(String));

  return {
    sheet: sheetName,
    headers,
    rows: dataRows,
    textRepresentation: buildTextRepresentation(sheetName, headers, dataRows),
  };
}

function buildTextRepresentation(
  sheet: string,
  headers: string[],
  rows: string[][]
): string {
  const lines: string[] = [];
  lines.push(`Sheet: ${sheet}`);
  lines.push(`Columns (${headers.length}): ${headers.join(" | ")}`);
  lines.push(`Total rows: ${rows.length}`);
  lines.push("");

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = headers.map((h, j) => {
      const val = (row[j] ?? "").trim();
      // Truncate very long cells for LLM context efficiency
      const display = val.length > 500 ? val.slice(0, 500) + "..." : val;
      return `${h}: ${display}`;
    });
    lines.push(`--- Row ${i + 1} ---`);
    lines.push(cells.join("\n"));
  }

  return lines.join("\n");
}
