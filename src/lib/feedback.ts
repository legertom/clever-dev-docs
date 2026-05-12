/**
 * Feedback signal: two write paths into one table.
 *
 *   - low_confidence: server-side, fired when retrieval similarity falls
 *     below the confidence threshold. The strongest signal of a doc gap
 *     — these are the questions developers are asking that we can't
 *     answer well today.
 *
 *   - user_report: explicit user "flag for review" on an answer they
 *     thought was bad. The strongest signal that a particular answer
 *     was unhelpful even when retrieval *did* work.
 *
 *   - guardrail: server-side, fired when query classification blocks a
 *     query before it reaches the RAG pipeline (off-topic, harmful, or
 *     nonsense). Tracks abuse patterns separately from doc gaps.
 *
 * All three feed the /feedback admin page where a support / docs team would
 * triage them. Inserts are best-effort: a failure to log feedback should
 * never break the user's chat or fail their report submission.
 */

import { getSupabase } from "./supabase";

export type FeedbackKind = "low_confidence" | "user_report" | "guardrail";

export interface FeedbackRow {
  kind: FeedbackKind;
  query?: string;
  response?: string;
  user_note?: string;
  retrieved_urls?: string[];
  top_similarity?: number;
  category?: string;
}

export async function insertFeedback(row: FeedbackRow): Promise<void> {
  const { error } = await getSupabase().from("feedback").insert(row);
  if (error) {
    // Best-effort logging. Surface to server logs so we know if the
    // feedback pipeline is broken, but don't throw — the user's chat
    // shouldn't fail because we couldn't log.
    console.error("[feedback] insert failed", { kind: row.kind, error });
  }
}

// Fire-and-forget variant for use inside hot paths like the chat route.
// Returns immediately; insert continues in the background. Errors are
// logged but cannot affect the caller.
export function logFeedbackAsync(row: FeedbackRow): void {
  insertFeedback(row).catch((err) => {
    console.error("[feedback] background insert threw", err);
  });
}
