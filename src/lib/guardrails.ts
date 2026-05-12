import { generateText } from "ai";
import { DEFAULT_CHAT_MODEL } from "./rag";

export type QueryCategory = "on_topic" | "off_topic" | "harmful" | "nonsense";

const CLASSIFICATION_PROMPT = `You are a query classifier for a Clever developer documentation chatbot (dev.clever.com). Clever is an ed-tech platform that connects school data to learning applications.

Classify the user's query into EXACTLY one category. Respond with only the category name, nothing else.

Categories:
- on_topic: Questions about Clever's developer platform, APIs, integrations, SDKs, SSO, rostering, data model, certification, Clever Library, Secure Sync, LMS Connect, or related developer topics.
- off_topic: General programming questions, unrelated technical topics, or questions that have nothing to do with Clever. Examples: "reverse a linked list", "how does React work", "what's the weather".
- harmful: Threats, harassment, hate speech, references to violence, self-harm, or dangerous/illegal requests.
- nonsense: Gibberish, random characters, insults, trolling, profanity directed at people, or meaningless input.`;

export const CANNED_RESPONSES: Record<
  Exclude<QueryCategory, "on_topic">,
  string
> = {
  off_topic:
    "I can only answer questions about the **Clever developer platform** — APIs, integrations, certification, data model, and related topics. For general programming help, try Stack Overflow or your preferred coding assistant.",
  harmful:
    "I’m not able to engage with that type of message. If you need help with something related to Clever’s developer platform, I’m here to help.",
  nonsense:
    "I can only answer questions about the **Clever developer platform**. Try asking about APIs, integrations, certification, or the data model.",
};

export async function classifyQuery(query: string): Promise<QueryCategory> {
  if (!query || query.trim().length < 2) return "nonsense";
  if (query.length > 2000) return "nonsense";

  const { text } = await generateText({
    model: DEFAULT_CHAT_MODEL,
    system: CLASSIFICATION_PROMPT,
    prompt: query,
    maxOutputTokens: 16,
  });

  const category = text.trim().toLowerCase().replace(/[^a-z_]/g, "");
  if (isGuardrailCategory(category)) return category;

  return "on_topic";
}

function isGuardrailCategory(value: string): value is QueryCategory {
  return ["on_topic", "off_topic", "harmful", "nonsense"].includes(value);
}
