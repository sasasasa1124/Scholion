import { NextResponse } from "next/server";
import { getExamList } from "@/lib/csv";

// Node.js runtime required — reads CSV files via fs/process.cwd()
export async function GET() {
  const exams = await getExamList();
  return NextResponse.json(exams);
}
