/**
 * Temporary debug endpoint — bypasses auth, tests DB + batch_jobs table.
 * DELETE THIS FILE before production hardening.
 */
import { NextResponse } from "next/server";
import { getDB, isPg } from "@/lib/db";
import { getActiveJob, getBatchJob, createBatchJob } from "@/lib/batch-job";

export async function GET() {
  const steps: Record<string, unknown> = {};

  try {
    steps.isPg = isPg();
    steps.DATABASE_URL_set = !!process.env.DATABASE_URL;
    steps.DEPLOY_TARGET = process.env.DEPLOY_TARGET ?? "(not set)";

    const pg = getDB();
    steps.getDB = pg ? "ok" : "null";

    if (!pg) {
      return NextResponse.json({ ok: false, steps, error: "getDB() returned null" });
    }

    // Test raw SQL
    try {
      const rows = await pg<{ now: string }[]>`SELECT NOW() AS now`;
      steps.sql_now = rows[0]?.now ?? "no row";
    } catch (e) {
      steps.sql_now_error = e instanceof Error ? e.message : String(e);
    }

    // Test ensureTable + getActiveJob
    try {
      const job = await getActiveJob(pg, "experience_cloud_consultant_exam_en", "fill");
      steps.getActiveJob_fill = job ?? null;
    } catch (e) {
      steps.getActiveJob_fill_error = e instanceof Error ? e.message : String(e);
    }

    // Test createBatchJob
    try {
      const jobId = await createBatchJob(pg, "__debug_exam__", "fill", { debug: true });
      steps.createBatchJob = jobId;
      // Clean up
      await pg`DELETE FROM batch_jobs WHERE id = ${jobId}`;
      steps.cleanup = "ok";
    } catch (e) {
      steps.createBatchJob_error = e instanceof Error ? e.message : String(e);
    }

    return NextResponse.json({ ok: true, steps });
  } catch (e) {
    return NextResponse.json({ ok: false, steps, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
