import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  UIMessage,
} from "ai";
import {
  retrieveRelevantChunks,
  buildSystemPrompt,
  DEFAULT_CHAT_MODEL,
  CONFIDENCE_THRESHOLD,
  type RetrievalMode,
} from "@/lib/rag";
import { classifyQuery, CANNED_RESPONSES } from "@/lib/guardrails";
import { getRateLimiter } from "@/lib/rate-limit";
import { logFeedbackAsync } from "@/lib/feedback";
import { condenseQuery } from "@/lib/query-rewrite";

// Vercel Function timeout. Generous enough for a long answer, low
// enough that a stuck request doesn't burn budget. In production you'd
// surface this in observability and tune based on p99 generation time.
export const maxDuration = 30;

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const { success } = await getRateLimiter().limit(ip);
  if (!success) {
    return new Response("Too many requests. Please try again shortly.", {
      status: 429,
    });
  }

  const body: { messages: UIMessage[]; retrievalMode?: string } = await req.json();
  const { messages } = body;
  // Validate per-request override; fall back to the env default if absent
  // or invalid. The retriever's 4th arg already reads RETRIEVAL_MODE from
  // env when no explicit mode is passed, so undefined here means "use env".
  const requestedMode: RetrievalMode | undefined =
    body.retrievalMode === "vector" || body.retrievalMode === "hybrid"
      ? body.retrievalMode
      : undefined;

  // Pull out the latest user message text for classification and as the
  // fallback retrieval query.
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  const queryText =
    lastUserMessage?.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join(" ") ?? "";

  const category = await classifyQuery(queryText);

  if (category !== "on_topic") {
    logFeedbackAsync({
      kind: "guardrail",
      query: queryText,
      category,
      ip,
    });

    const responseText = CANNED_RESPONSES[category];
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({ type: "text-start", id: "0" });
        writer.write({ type: "text-delta", id: "0", delta: responseText });
        writer.write({ type: "text-end", id: "0" });
      },
    });
    return createUIMessageStreamResponse({ stream });
  }

  // Condense the conversation into a single self-contained question
  // before retrieval. On single-turn conversations this is a no-op
  // (returns queryText unchanged); on multi-turn it makes a cheap LLM
  // call to expand follow-ups like "what about student email?" into a
  // full question that captures the context from prior turns. Errors
  // fall back to queryText, so a rewrite failure never breaks the chat.
  const { queryForRetrieval, didRewrite } = await condenseQuery(
    messages,
    queryText
  );
  if (didRewrite) {
    console.log(`[query-rewrite] "${queryText}" → "${queryForRetrieval}"`);
  }

  const chunks = await retrieveRelevantChunks(
    queryForRetrieval,
    5,
    0.5,
    requestedMode
  );
  const systemPrompt = buildSystemPrompt(chunks);

  // Doc-gap signal: if retrieval falls below the confidence threshold,
  // record the query so the docs/support team can see what developers
  // are asking that we can't answer well today. Fire-and-forget so the
  // user's response is never delayed by the log write.
  //
  // Read the raw cosine score (`vec_sim`) when available, not the
  // post-rescue `similarity`. Under hybrid retrieval, `similarity` is
  // intentionally inflated to clear the 0.6 gate for FTS-rescued
  // chunks (see scripts/setup-db.sql) — using it here would silence
  // the doc-gap alarm whenever ANY keyword hits, which is almost
  // always. Vector-only mode doesn't return `vec_sim`, so we fall
  // back to `similarity` (which IS raw cosine in that mode).
  const topChunk = chunks[0];
  const triggerScore = topChunk?.vec_sim ?? topChunk?.similarity ?? 0;
  if (triggerScore <= CONFIDENCE_THRESHOLD && queryForRetrieval) {
    // Log the rewritten query so the docs team sees what was actually
    // searched on — a bare follow-up like "what about email?" isn't
    // actionable, but its rewritten form ("what student email fields
    // does Clever Library expose?") is. For single-turn conversations
    // queryForRetrieval === queryText, so behavior is unchanged.
    logFeedbackAsync({
      kind: "low_confidence",
      query: queryForRetrieval,
      retrieved_urls: chunks.map((c) => c.url),
      top_similarity: triggerScore,
    });
  }

  // Model is passed as a string — AI SDK v6 routes string models through
  // the Vercel AI Gateway by default. On deployed Vercel functions this
  // uses OIDC auth (no API key in env). Locally, AI_GATEWAY_API_KEY is
  // picked up from .env.local.
  const result = streamText({
    model: DEFAULT_CHAT_MODEL,
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
