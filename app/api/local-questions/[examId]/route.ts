import { NextResponse } from "next/server";
import { getQuestions } from "@/lib/csv";

// Node.js runtime required — reads CSV files via fs/process.cwd()
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;
  const questions = await getQuestions(examId);
  return NextResponse.json(questions);
}
