import { gateway } from "@ai-sdk/gateway";
import { embedMany, embed } from "ai";
import { getSupabase } from "./supabase";

export interface DocumentChunk {
  content: string;
  url: string;
  title: string;
  similarity: number;
}

// ── Models ───────────────────────────────────────────────────
// All model references go through the Vercel AI Gateway.
// On deployed Vercel functions, OIDC auth is automatic — no API key
// in env vars. Locally, set AI_GATEWAY_API_KEY (or use `vercel env pull`
// after `vercel link` to pick up a dev OIDC token).
//
// Embeddings use a small, cheap model. text-embedding-3-small at 1536
// dims is the right cost/quality trade-off for technical documentation.
// In production at scale, you'd benchmark text-embedding-3-large
// (3072 dims) against the smaller model on a held-out test set —
// the larger model's recall improvement may not justify 2x the storage
// and slower retrieval.
export const EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const DEFAULT_CHAT_MODEL = "openai/gpt-4o-mini";

// ── System prompt ────────────────────────────────────────────
const SYSTEM_PROMPT_TEMPLATE = `You are a developer support assistant for Clever (clever.com), helping developers integrate with the Clever platform. You specialize in Clever Library, SSO, certification, and the Clever API.

Your audience is developers — often newer "vibe coder" types — building apps for the Clever Library and going through certification to submit to the Clever App Store.

CONTENT RULES:
1. ONLY answer based on the documentation context provided below. If the context does not contain enough information, say so clearly. Never guess or infer requirements that aren't explicitly stated in the docs.
2. NEVER hallucinate certification requirements, API fields, data model details, or policies. A developer acting on incorrect certification guidance could waste weeks on a bad submission.
3. Cite your sources inline using markdown links: \`[Source page title](https://dev.clever.com/...)\`. Cite at the END of the relevant claim, not as a separate "Source:" footer line.
4. Be concise and practical. Developers want actionable answers, not essays.
5. If a question is outside the scope of the documentation you have (e.g., about Secure Sync, LMS Connect, billing, or account-specific issues), say so and suggest contacting Clever support.
6. NEVER offer follow-up help like "If you want, I can…" or "Would you like more on…". Answer the question, cite sources, stop. The user can ask another question if they want one.

FORMAT RULES (markdown):
- Always put a BLANK LINE between paragraphs. Do not let lines run together.
- Use \`##\` for section headers if the answer has multiple distinct sections (rare — only for genuinely long answers).
- Use bullet lists (\`- \`) for enumerations of three or more items.
- Use \`\`\`\` code blocks \`\`\`\` for endpoint paths, code, or JSON.
- Put endpoint paths and field names in \`backticks\`.
- For comparisons of two or three things, use a markdown table with \`| Aspect | A | B |\` syntax.

DOCUMENTATION CONTEXT:
{context}`;

const FALLBACK_SUFFIX = `

IMPORTANT: The retrieval system found no strong matches for this query. Tell the developer you couldn't find a confident answer in the docs. Suggest they check dev.clever.com directly or contact Clever support at support@clever.com. Do NOT attempt to answer from general knowledge.`;

// Confidence threshold above which we trust retrieval. Below this, we
// trigger the fallback prompt that explicitly tells the model to admit
// uncertainty rather than improvise.
export const CONFIDENCE_THRESHOLD = 0.6;

export function buildSystemPrompt(chunks: DocumentChunk[]): string {
  const hasRelevantContext =
    chunks.length > 0 && chunks[0].similarity > CONFIDENCE_THRESHOLD;

  const context =
    chunks.length > 0
      ? chunks
          .map((c) => `[Source: ${c.title} — ${c.url}]\n${c.content}`)
          .join("\n\n---\n\n")
      : "No relevant documentation found for this query.";

  return (
    SYSTEM_PROMPT_TEMPLATE.replace("{context}", context) +
    (hasRelevantContext ? "" : FALLBACK_SUFFIX)
  );
}

// ── Retrieval ────────────────────────────────────────────────
// Given a user query, embed it and find the most relevant doc chunks.
// match_count and match_threshold are tunable per-environment:
//   - Higher threshold = fewer but more precise results (less hallucination risk)
//   - Lower threshold = broader recall (useful for vague queries)
export async function retrieveRelevantChunks(
  query: string,
  matchCount = 5,
  matchThreshold = 0.5
): Promise<DocumentChunk[]> {
  const { embedding } = await embed({
    model: gateway.textEmbeddingModel(EMBEDDING_MODEL),
    value: query,
  });

  const { data, error } = await getSupabase().rpc("match_documents", {
    query_embedding: embedding,
    match_count: matchCount,
    match_threshold: matchThreshold,
  });

  if (error) {
    console.error("Vector search failed:", error);
    return [];
  }

  return (data ?? []).map(
    (row: {
      content: string;
      url: string;
      title: string;
      similarity: number;
    }) => ({
      content: row.content,
      url: row.url,
      title: row.title,
      similarity: row.similarity,
    })
  );
}

// ── Embedding (for ingestion) ────────────────────────────────
// Batch-embeds text chunks during the ingestion pipeline.
// The AI SDK's embedMany handles batching and rate-limit retries.
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: gateway.textEmbeddingModel(EMBEDDING_MODEL),
    values: texts,
  });
  return embeddings;
}
