/**
 * /api/feedback — accepts user_report submissions from the chat UI.
 *
 * Validates input, inserts into the shared feedback table. The chat
 * route writes low_confidence rows directly (server-side) without
 * round-tripping through this endpoint, since it has the embedding
 * context already.
 *
 * No auth: anyone interacting with the chat can flag an answer. This
 * is appropriate for public docs — the cost of a spurious flag is
 * trivial; the cost of a missed real complaint is high.
 *
 * For production at scale, add rate limiting (e.g. Upstash on IP) so a
 * single client can't flood the queue.
 */

import { insertFeedback } from "@/lib/feedback";

export const maxDuration = 10;

interface ReportRequest {
  query?: string;
  response?: string;
  user_note?: string;
}

export async function POST(req: Request) {
  let body: ReportRequest;
  try {
    body = (await req.json()) as ReportRequest;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Cap field sizes to prevent abuse / accidental huge inserts. These
  // are public-input endpoints so we treat all values as untrusted.
  const query = (body.query ?? "").slice(0, 2000);
  const response = (body.response ?? "").slice(0, 8000);
  const user_note = (body.user_note ?? "").slice(0, 1000);

  if (!query && !response && !user_note) {
    return Response.json(
      { error: "At least one of query/response/user_note required" },
      { status: 400 }
    );
  }

  await insertFeedback({
    kind: "user_report",
    query,
    response,
    user_note,
  });

  return Response.json({ ok: true });
}
