import { NextRequest, NextResponse } from "next/server";
import { updateExamMeta } from "@/lib/db";

export const runtime = "edge";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json() as { name?: string; language?: string };

  const fields: { name?: string; language?: "ja" | "en" } = {};
  if (typeof body.name === "string" && body.name.trim()) {
    fields.name = body.name.trim();
  }
  if (body.language === "ja" || body.language === "en") {
    fields.language = body.language;
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "no valid fields" }, { status: 400 });
  }

  await updateExamMeta(id, fields);
  return NextResponse.json({ ok: true });
}
