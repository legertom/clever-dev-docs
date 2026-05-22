import { gateway } from "@ai-sdk/gateway";
import { embedMany, embed } from "ai";
import { getSupabase } from "./supabase";

export interface DocumentChunk {
  content: string;
  url: string;
  title: string;
  similarity: number;
  // Raw cosine similarity, before any FTS-rescue inflation. Only
  // populated by the hybrid retrieval function — undefined in
  // vector-only mode (where `similarity` is already raw cosine).
  // The chat route reads this in preference to `similarity` when
  // deciding whether to log low_confidence feedback rows.
  vec_sim?: number;
  integration_path?: string;
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
const SYSTEM_PROMPT_TEMPLATE = `You are a developer support assistant for Clever (clever.com), helping developers integrate with the Clever platform. You cover the entire public developer documentation: Clever Library, District SSO, Secure Sync, LMS Connect, Attendance Data, the Clever API, and the data model.

Your primary audience is independent developers building apps for the Clever Library and going through certification to submit to the Clever App Store. But you also help developers exploring other integration paths.

CONTENT RULES:
1. ONLY answer based on the documentation context provided below. If the context does not contain enough information, say so clearly. Never guess or infer requirements that aren't explicitly stated in the docs.
2. NEVER hallucinate certification requirements, API fields, data model details, or policies. A developer acting on incorrect certification guidance could waste weeks on a bad submission.
3. Cite your sources inline using markdown links: \`[Source page title](https://dev.clever.com/...)\`. Cite at the END of the relevant claim, not as a separate "Source:" footer line.
4. Be concise and practical. Developers want actionable answers, not essays.
5. If a question requires account-specific information (billing, support tickets, why a specific request failed for a specific user), say so and direct the developer to open a support ticket at dev.clever.com, or reply to the last email they received from Clever for a status update — those answers are not in the documentation.
6. NEVER offer follow-up help like "If you want, I can…" or "Would you like more on…". Answer the question, cite sources, stop. The user can ask another question if they want one.

INTEGRATION-PATH DISAMBIGUATION:
Many answers differ depending on which integration path the developer is using (Clever Library vs Secure Sync vs LMS Connect). When the answer materially differs by path — especially data fields, API access, rostering behavior, or certification requirements — you MUST distinguish between them. Either:
  a. Present both variants with clear headers (e.g. "## Clever Library" and "## Secure Sync"), or
  b. Ask which integration path the developer is using before answering.
Prefer (a) when the answer is short enough to show both. Use (b) only when the answer would be very long or confusing with both paths combined. NEVER give a flat answer that only applies to one path when the question is ambiguous.
Each retrieved chunk may include a "[Path: ...]" tag indicating which integration it applies to — use this to organize your answer correctly.

AUDIENCE ROUTING:
Some integration paths require working directly with a Clever Application Success Manager (ASM): Secure Sync (district-managed rostering), LMS Connect, and other district-level integrations. Independent developers cannot self-serve these — they require a signed Clever Complete agreement.
- When you answer questions about these paths, ALWAYS open or close with a one-line note: e.g. *"Note: Secure Sync requires working with a Clever Application Success Manager — contact partnerships@clever.com to start that conversation."*
- If a developer's question SUGGESTS they're on the wrong path (e.g. an indie dev asking how to set up district-wide rostering), gently surface the alternative: *"It sounds like you might want Clever Library instead, which is the self-serve, teacher-managed path. Library covers [their need] without requiring an ASM."*
- Never refuse to answer a documentation question just because the path requires an ASM. Answer it, and add the routing note.

FORMAT RULES (you MUST output valid markdown — the UI renders it):
- ALWAYS put a blank line before and after headers, lists, code blocks, and tables. Without blank lines, markdown will not render.
- Use \`## Header\` for section headers. Use them whenever the answer covers more than one distinct topic or integration path.
- ALWAYS use \`- \` (dash space) to start bullet list items. Never write list-like content as plain text lines — if you are listing things, use bullets. Example:
  \`\`\`
  ## Available Fields

  - \`roles.student.school\` — primary school ID
  - \`roles.student.sis_id\` — SIS identifier
  \`\`\`
- Use \`\`\`\` code blocks \`\`\`\` for endpoint paths, code, or JSON.
- Put endpoint paths and field names in \`backticks\`.
- For comparisons of two or three things, use a markdown table with \`| Aspect | A | B |\` syntax.
- Bold key terms with \`**term**\` when introducing an important concept for the first time.

DOCUMENTATION CONTEXT:
{context}`;

const FALLBACK_SUFFIX = `

IMPORTANT: The retrieval system found no strong matches for this query. Tell the developer you couldn't find a confident answer in the docs. Suggest they check dev.clever.com directly or open a support ticket there for help. Do NOT attempt to answer from general knowledge.`;

// Confidence threshold above which we trust retrieval. Below this, we
// trigger the fallback prompt that explicitly tells the model to admit
// uncertainty rather than improvise.
export const CONFIDENCE_THRESHOLD = 0.6;

export function buildSystemPrompt(chunks: DocumentChunk[]): string {
  const hasRelevantContext =
    chunks.length > 0 && chunks[0].similarity > CONFIDENCE_THRESHOLD;

  // When the top match is below CONFIDENCE_THRESHOLD, suppress the weak
  // context entirely rather than passing it alongside the fallback
  // suffix — the model would otherwise receive contradictory signals
  // ("here are some chunks" + "no strong matches were found").
  const context = hasRelevantContext
    ? chunks
        .map((c) => {
          const pathTag = c.integration_path ? ` | Path: ${c.integration_path}` : "";
          return `[Source: ${c.title} — ${c.url}${pathTag}]\n${c.content}`;
        })
        .join("\n\n---\n\n")
    : "No relevant documentation found for this query.";

  return (
    SYSTEM_PROMPT_TEMPLATE.replace("{context}", context) +
    (hasRelevantContext ? "" : FALLBACK_SUFFIX)
  );
}

// ── Retrieval ────────────────────────────────────────────────
//
// Two SQL functions back retrieval, intentionally living under
// different names so neither can shadow the other:
//   • match_documents          — vector-only (cosine similarity)
//   • match_documents_hybrid   — vector + Postgres FTS, fused via
//                                Reciprocal Rank Fusion in SQL
//                                (see scripts/setup-db.sql)
//
// PR #15's outage came from app-code calling a 4-arg signature that
// did not exist in prod. Keeping the hybrid path under its own SQL
// name removes every overload-resolution failure mode: PostgREST
// resolves by name first, so flipping RETRIEVAL_MODE cannot touch
// the vector-only function or its callers.
//
// Default mode is "vector". Set RETRIEVAL_MODE=hybrid in the
// runtime env to switch the public retriever without redeploying.
//
// match_count / match_threshold tuning:
//   - Higher threshold = fewer but more precise results
//   - Lower threshold  = broader recall (useful for vague queries)
//   match_threshold gates the vector pool only; hybrid always
//   admits FTS-rescued chunks regardless of cosine score.

export type RetrievalMode = "vector" | "hybrid";

function defaultRetrievalMode(): RetrievalMode {
  // Trim/lowercase before comparison: `vercel env add` from `echo "hybrid"`
  // stores the trailing newline as part of the value, which silently
  // breaks strict equality and falls through to the default. Defensive
  // normalization here means env-var hygiene cannot cause hybrid to look
  // disabled when it shouldn't be.
  return process.env.RETRIEVAL_MODE?.trim().toLowerCase() === "hybrid"
    ? "hybrid"
    : "vector";
}

async function embedQuery(query: string): Promise<number[]> {
  const { embedding } = await embed({
    model: gateway.textEmbeddingModel(EMBEDDING_MODEL),
    value: query,
  });
  return embedding;
}

type RetrievalRow = {
  content: string;
  url: string;
  title: string;
  similarity: number;
  vec_sim?: number;
  integration_path?: string;
};

function toChunks(data: RetrievalRow[] | null): DocumentChunk[] {
  return (data ?? []).map((row) => ({
    content: row.content,
    url: row.url,
    title: row.title,
    similarity: row.similarity,
    vec_sim: row.vec_sim,
    integration_path: row.integration_path,
  }));
}

async function retrieveVectorOnly(
  query: string,
  matchCount: number,
  matchThreshold: number
): Promise<DocumentChunk[]> {
  const embedding = await embedQuery(query);
  const { data, error } = await getSupabase().rpc("match_documents", {
    query_embedding: embedding,
    match_count: matchCount,
    match_threshold: matchThreshold,
  });
  if (error) {
    console.error("Vector search failed:", error);
    return [];
  }
  return toChunks(data);
}

export async function retrieveRelevantChunksHybrid(
  query: string,
  matchCount = 5,
  matchThreshold = 0.5
): Promise<DocumentChunk[]> {
  const embedding = await embedQuery(query);
  const { data, error } = await getSupabase().rpc("match_documents_hybrid", {
    query_embedding: embedding,
    query_text: query,
    match_count: matchCount,
    match_threshold: matchThreshold,
  });
  if (error) {
    console.error("Hybrid search failed:", error);
    return [];
  }
  return toChunks(data);
}

export async function retrieveRelevantChunks(
  query: string,
  matchCount = 5,
  matchThreshold = 0.5,
  mode: RetrievalMode = defaultRetrievalMode()
): Promise<DocumentChunk[]> {
  return mode === "hybrid"
    ? retrieveRelevantChunksHybrid(query, matchCount, matchThreshold)
    : retrieveVectorOnly(query, matchCount, matchThreshold);
}

// ── Embedding helper ─────────────────────────────────────────
// Batch-embeds text via embedMany at EMBEDDING_MODEL. Currently
// unused: the ingestion pipeline (scripts/ingest.ts) inlines its
// own embedMany call rather than importing this helper.
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: gateway.textEmbeddingModel(EMBEDDING_MODEL),
    values: texts,
  });
  return embeddings;
}
