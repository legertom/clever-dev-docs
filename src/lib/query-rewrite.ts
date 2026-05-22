/**
 * Query rewriting for multi-turn conversations.
 *
 * The chat route's retrieval step searches the docs using only the
 * developer's most recent message. That breaks on follow-up questions
 * that only make sense in context:
 *
 *   developer: what data fields does Clever Library expose?
 *   assistant: [retrieval finds Library fields page, answers well]
 *
 *   developer: what about student email?
 *   assistant: [retrieval sees only "what about student email?" — has
 *               no idea this is about Library — pulls chunks about
 *               email from anywhere in the docs]
 *
 * `condenseQuery` makes a fast LLM call that rolls the conversation
 * into a single self-contained question. The retrieval step then
 * embeds and searches on THAT — so the right context comes back even
 * when the user's last message was a shorthand follow-up.
 *
 * Single-turn conversations (one user message, no history) skip the
 * rewrite entirely — there's nothing to condense. Errors fall back to
 * the raw last message, so a rewrite failure never breaks the chat.
 *
 * Enabled by default. Disable via env: QUERY_REWRITE=off.
 */

import { generateText } from "ai";
import type { UIMessage } from "ai";
import { DEFAULT_CHAT_MODEL } from "./rag";

const REWRITE_PROMPT = `You rewrite developer questions for a Clever documentation retrieval system. Given a conversation between a developer and the assistant, output a SINGLE self-contained question that captures what the developer is asking in their MOST RECENT message, with any referenced context filled in from earlier turns.

Rules:
- Output ONLY the rewritten question. No preamble, no quotes, no explanation.
- If the most recent message is already self-contained, output it verbatim.
- If it references prior turns (e.g. "what about X?", "and the other one?", "is that documented?"), expand the reference into a complete question.
- Preserve the developer's terminology — do not "improve" their phrasing or substitute synonyms.
- Keep it concise. Under 30 words is ideal.`;

function isEnabled(): boolean {
  // Default ON. Set QUERY_REWRITE=off to disable without redeploying.
  return process.env.QUERY_REWRITE?.trim().toLowerCase() !== "off";
}

function extractText(message: UIMessage): string {
  return (
    message.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join(" ") ?? ""
  );
}

export interface CondenseResult {
  /** What retrieval should actually search with. */
  queryForRetrieval: string;
  /** The raw text of the developer's most recent user message. */
  originalQuery: string;
  /** True if the LLM was called and produced a meaningful rewrite. */
  didRewrite: boolean;
}

export async function condenseQuery(
  messages: UIMessage[],
  latestUserText: string
): Promise<CondenseResult> {
  const userMessageCount = messages.filter((m) => m.role === "user").length;

  // Nothing to condense: single-turn conversation, or feature disabled.
  if (!isEnabled() || userMessageCount <= 1) {
    return {
      queryForRetrieval: latestUserText,
      originalQuery: latestUserText,
      didRewrite: false,
    };
  }

  // Build a plain transcript the rewriter model can read. Include the
  // assistant turns — the references the developer is following up on
  // often live in *what the assistant said*, not in their own prior
  // questions.
  const transcript = messages
    .map((m) => `${m.role === "user" ? "Developer" : "Assistant"}: ${extractText(m)}`)
    .filter((line) => !line.endsWith(": "))
    .join("\n");

  try {
    const { text } = await generateText({
      model: DEFAULT_CHAT_MODEL,
      system: REWRITE_PROMPT,
      prompt: transcript,
      maxOutputTokens: 120,
    });
    const rewritten = text.trim();

    // If the model returned nothing useful, fall back to the raw query.
    // Equality check covers the "already self-contained" case where the
    // rewriter correctly echoed the latest message — no need to flag it
    // as a rewrite for logging purposes.
    if (!rewritten || rewritten === latestUserText) {
      return {
        queryForRetrieval: latestUserText,
        originalQuery: latestUserText,
        didRewrite: false,
      };
    }

    return {
      queryForRetrieval: rewritten,
      originalQuery: latestUserText,
      didRewrite: true,
    };
  } catch (err) {
    // Best-effort. A rewrite failure should never break the chat —
    // surface to server logs and continue with the raw query.
    console.error("[query-rewrite] failed, using raw last message:", err);
    return {
      queryForRetrieval: latestUserText,
      originalQuery: latestUserText,
      didRewrite: false,
    };
  }
}
