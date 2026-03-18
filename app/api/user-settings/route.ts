import { NextRequest, NextResponse } from "next/server";
import { getAllUserSettings, setUserSettings } from "@/lib/db";
import { getUserEmail } from "@/lib/user";
import type { UserSettings } from "@/lib/types";

export const runtime = "edge";

export async function GET() {
  const userEmail = await getUserEmail();
  const settings = await getAllUserSettings(userEmail);
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const body = await req.json() as Partial<UserSettings>;
  const userEmail = await getUserEmail();
  await setUserSettings(userEmail, body);
  return NextResponse.json({ ok: true });
}
