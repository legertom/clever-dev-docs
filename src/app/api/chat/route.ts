import { streamText, convertToModelMessages, UIMessage } from "ai";
import {
  retrieveRelevantChunks,
  buildSystemPrompt,
  DEFAULT_CHAT_MODEL,
} from "@/lib/rag";

// Vercel Function timeout. Generous enough for a long answer, low
// enough that a stuck request doesn't burn budget. In production you'd
// surface this in observability and tune based on p99 generation time.
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Pull out the latest user query for retrieval.
  // For multi-turn chat, we use the most recent user message as the
  // retrieval query. A more sophisticated approach would condense the
  // whole conversation into a single retrieval query — relevant when
  // follow-up questions reference prior context (e.g. "what about
  // student email?" after asking about Library data fields).
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  const queryText =
    lastUserMessage?.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join(" ") ?? "";

  const chunks = await retrieveRelevantChunks(queryText);
  const systemPrompt = buildSystemPrompt(chunks);

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
