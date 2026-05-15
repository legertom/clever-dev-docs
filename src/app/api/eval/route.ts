/**
 * /api/eval — runs a single eval question through the RAG pipeline
 * with a specified model and returns the answer + rubric scores + cost.
 *
 * Used by the /eval page for live, in-browser evaluation. The page
 * calls this endpoint once per (question × model) combination so it
 * can render results progressively rather than waiting for the full
 * grid to complete.
 *
 * All models are accessed via the Vercel AI Gateway, which means
 * cross-provider comparison (OpenAI vs Anthropic vs Google) requires
 * zero code changes — just add a string to the allowlist.
 */

import { generateText } from "ai";
import {
  retrieveRelevantChunks,
  buildSystemPrompt,
  type RetrievalMode,
} from "@/lib/rag";

export const maxDuration = 60;

// Allowlist of models the eval UI can request. This protects the
// endpoint from being used to invoke arbitrary expensive models
// (cost protection) and keeps the comparison set scoped to the
// trade-offs we want to demonstrate:
//   - gpt-4o-mini: cheap production baseline
//   - gpt-5.4:     flagship — does the expensive model actually help?
//   - claude-haiku-4.5: cross-provider via the same gateway
const ALLOWED_MODELS = new Set([
  "openai/gpt-4o-mini",
  "openai/gpt-5.4",
  "anthropic/claude-haiku-4.5",
]);

// Per-token pricing in USD, sourced from the AI Gateway models endpoint:
//   curl https://ai-gateway.vercel.sh/v1/models
// Costs change occasionally — for production, fetch live via
// gateway.getAvailableModels() instead of hardcoding.
//
// Easier-to-read /1M tokens equivalents:
//   openai/gpt-4o-mini       — $0.15 in / $0.60 out
//   openai/gpt-5.4           — $2.50 in / $15.00 out
//   anthropic/claude-haiku-4.5 — $1.00 in / $5.00 out
//
// gpt-5.4 is ~17x more expensive on input, ~25x on output vs gpt-4o-mini.
// The eval is what justifies whether that premium is worth it.
const MODEL_PRICING: Record<
  string,
  { input: number; output: number }
> = {
  "openai/gpt-4o-mini": { input: 0.00000015, output: 0.0000006 },
  "openai/gpt-5.4": { input: 0.0000025, output: 0.000015 },
  "anthropic/claude-haiku-4.5": { input: 0.000001, output: 0.000005 },
};

// Judge model — Anthropic Claude Sonnet 4.6.
//
// Two reasons:
// 1. CROSS-FAMILY BIAS REDUCTION. Two of our three candidate models are
//    OpenAI. Using a Claude judge eliminates same-family bias for those
//    two — there's published evidence that same-family LLM-as-judge
//    setups systematically over-rate same-family outputs. The third
//    candidate (Claude Haiku 4.5) gets judged by a stronger Claude,
//    which biases against rather than for it — also fine, the bias
//    direction is now consistent and known.
//
// 2. CAPABILITY MATCH. A judge should be at least as smart as the
//    smartest candidate. Sonnet 4.6 sits comfortably above all three.
//
// Trade-off: ~25x more expensive per judge call than gpt-4o-mini
// ($0.003 vs $0.0001), but eval still runs for under $1 per full
// 15-question × 3-model pass. Eval cost is operational overhead, not
// per-query production cost — the price displayed on each eval result
// remains the candidate model cost only.
const JUDGE_MODEL = "anthropic/claude-sonnet-4.6";

interface EvalRequest {
  question: string;
  expected_answer: string;
  criteria: string[];
  expected_source: string | null;
  model: string;
  retrievalMode?: string;
}

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return inputTokens * pricing.input + outputTokens * pricing.output;
}

export async function POST(req: Request) {
  const body = (await req.json()) as EvalRequest;

  if (!ALLOWED_MODELS.has(body.model)) {
    return Response.json(
      { error: `Model ${body.model} not allowed` },
      { status: 400 }
    );
  }

  // 1. Retrieve relevant doc chunks. Mode is an explicit per-run choice
  // from the eval UI; fall back to the env default when absent/invalid.
  const requestedMode: RetrievalMode | undefined =
    body.retrievalMode === "vector" || body.retrievalMode === "hybrid"
      ? body.retrievalMode
      : undefined;
  const chunks = await retrieveRelevantChunks(
    body.question,
    5,
    0.5,
    requestedMode
  );
  const systemPrompt = buildSystemPrompt(chunks);

  // 2. Generate answer with the requested model. Capture usage so we can
  //    surface cost on the eval page — the cost story is the single most
  //    persuasive comparison between the cheap and flagship models.
  const result = await generateText({
    model: body.model,
    system: systemPrompt,
    prompt: body.question,
  });

  const answer = result.text;
  const inputTokens = result.usage?.inputTokens ?? 0;
  const outputTokens = result.usage?.outputTokens ?? 0;
  const cost = calculateCost(body.model, inputTokens, outputTokens);

  // 3. Score with LLM-as-judge.
  // Four dimensions, with correct vs complete deliberately separated:
  //   - correct      = nothing the answer says is wrong
  //   - complete     = the answer covers the key points the question demands
  // An answer can be correct but incomplete (e.g. "Yes, free to build" —
  // true, but omits the required freemium-for-end-users clause). That's
  // a meaningfully different failure from a wrong answer.
  const judgePrompt = `You are evaluating a RAG system's answer about Clever developer documentation.

QUESTION: ${body.question}

EXPECTED ANSWER: ${body.expected_answer}

ACTUAL ANSWER: ${answer}

EVALUATION CRITERIA:
${body.criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

The criteria are written with "must" (required for correctness) vs "should" (required for completeness). Use that distinction.

RETRIEVED SOURCES: ${chunks.map((c) => c.url).join(", ") || "none"}
EXPECTED SOURCE URL CONTAINS: ${body.expected_source ?? "(none — assistant should decline to answer)"}

Score the answer with simple yes/no on five dimensions:
1. correct: Nothing in the answer is factually wrong relative to the docs. An answer that is partial but accurate is correct=true. (Maps to "must" criteria.)
2. complete: The answer covers all the key points the question demands. An answer that is true but missing important context is complete=false. (Maps to "should" criteria.)
3. cites_source: Does the answer reference or link to a source document?
4. no_hallucination: Does the answer avoid fabricating information not present in the retrieved sources?
5. formatting: Is the answer well-formatted markdown? Checks: headers have blank lines around them, lists use proper "- " syntax, code/endpoints are in backticks or fenced blocks, and the structure is scannable (not a wall of text).

Respond ONLY with this exact JSON (no markdown, no prose):
{"correct": true/false, "complete": true/false, "cites_source": true/false, "no_hallucination": true/false, "formatting": true/false, "reasoning": "brief explanation under 100 chars"}`;

  const { text: judgeResponse } = await generateText({
    model: JUDGE_MODEL,
    prompt: judgePrompt,
  });

  let scores = {
    correct: false,
    complete: false,
    cites_source: false,
    no_hallucination: false,
    formatting: false,
    reasoning: "",
  };

  try {
    const cleaned = judgeResponse
      .replace(/```json?\n?/g, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    scores = {
      correct: !!parsed.correct,
      complete: !!parsed.complete,
      cites_source: !!parsed.cites_source,
      no_hallucination: !!parsed.no_hallucination,
      formatting: !!parsed.formatting,
      reasoning: parsed.reasoning ?? "",
    };
  } catch {
    scores.reasoning = `Parse error: ${judgeResponse.slice(0, 100)}`;
  }

  return Response.json({
    answer,
    scores,
    sources: chunks.map((c) => ({
      url: c.url,
      title: c.title,
      similarity: c.similarity,
    })),
    usage: {
      inputTokens,
      outputTokens,
      cost,
    },
  });
}
