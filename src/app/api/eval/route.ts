/**
 * /api/eval — runs a single eval question through the RAG pipeline
 * with a specified model and returns the answer + rubric scores.
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
import { retrieveRelevantChunks, buildSystemPrompt } from "@/lib/rag";

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

// Judge model is fixed to keep evaluation comparable across runs.
// Using the same judge for every contestant means we measure the
// contestant's quality, not judge variance.
const JUDGE_MODEL = "openai/gpt-4o-mini";

interface EvalRequest {
  question: string;
  expected_answer: string;
  criteria: string[];
  expected_source: string | null;
  model: string;
}

export async function POST(req: Request) {
  const body = (await req.json()) as EvalRequest;

  if (!ALLOWED_MODELS.has(body.model)) {
    return Response.json(
      { error: `Model ${body.model} not allowed` },
      { status: 400 }
    );
  }

  // 1. Retrieve relevant doc chunks
  const chunks = await retrieveRelevantChunks(body.question);
  const systemPrompt = buildSystemPrompt(chunks);

  // 2. Generate answer with the requested model
  const { text: answer } = await generateText({
    model: body.model,
    system: systemPrompt,
    prompt: body.question,
  });

  // 3. Score with LLM-as-judge
  const judgePrompt = `You are evaluating a RAG system's answer about Clever developer documentation.

QUESTION: ${body.question}

EXPECTED ANSWER: ${body.expected_answer}

ACTUAL ANSWER: ${answer}

EVALUATION CRITERIA:
${body.criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

RETRIEVED SOURCES: ${chunks.map((c) => c.url).join(", ") || "none"}
EXPECTED SOURCE URL CONTAINS: ${body.expected_source ?? "(none — assistant should decline to answer)"}

Score the answer with simple yes/no on three dimensions:
1. correct: Does the answer accurately reflect the docs based on the criteria?
2. cites_source: Does the answer reference or link to a source document?
3. no_hallucination: Does the answer avoid fabricating information not present in the retrieved sources?

Respond ONLY with this exact JSON (no markdown, no prose):
{"correct": true/false, "cites_source": true/false, "no_hallucination": true/false, "reasoning": "brief explanation under 100 chars"}`;

  const { text: judgeResponse } = await generateText({
    model: JUDGE_MODEL,
    prompt: judgePrompt,
  });

  let scores = {
    correct: false,
    cites_source: false,
    no_hallucination: false,
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
      cites_source: !!parsed.cites_source,
      no_hallucination: !!parsed.no_hallucination,
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
  });
}
