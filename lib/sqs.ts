/**
 * SQS job dispatch utility (AWS only).
 * Sends batch job messages to the Scholion SQS queue for durable delivery.
 * On Cloudflare, this is a no-op.
 */

import { isAWS } from "@/lib/ai-client";

const SQS_QUEUE_URL = "https://sqs.us-west-2.amazonaws.com/435788423370/Scholion";

export interface SqsBatchJobMessage {
  jobId: string;
  examId: string;
  jobType: "fill" | "refine" | "factcheck";
  params: Record<string, unknown>;
}

export async function enqueueBatchJob(msg: SqsBatchJobMessage): Promise<void> {
  if (!isAWS) return;
  try {
    const { SQSClient, SendMessageCommand } = await import("@aws-sdk/client-sqs");
    const client = new SQSClient({ region: "us-west-2" });
    await client.send(new SendMessageCommand({
      QueueUrl: SQS_QUEUE_URL,
      MessageBody: JSON.stringify(msg),
    }));
  } catch (e) {
    // SQS failure is non-fatal: after() already handles immediate execution
    console.error("[sqs] enqueueBatchJob failed:", e instanceof Error ? e.message : String(e));
  }
}
