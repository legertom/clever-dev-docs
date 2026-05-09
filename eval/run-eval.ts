/**
 * CLI RAG evaluation script
 *
 * Sends each test question through the full RAG pipeline (retrieve → generate)
 * and uses an LLM-as-judge to score the response on three dimensions:
 *   1. Correctness: Does the answer accurately reflect the docs?
 *   2. Citation: Does it reference a source?
 *   3. No hallucination: Does it invent information not in the docs?
 *
 * Usage: pnpm eval
 *
 * Note: An interactive in-browser version is also deployed at /eval,
 * which lets you compare multiple models side-by-side. This CLI script
 * is for CI/regression use — pipe results into a tracking system or
 * fail the build if pass rate drops below a threshold.
 */

import { generateText } from "ai";
import {
  retrieveRelevantChunks,
  buildSystemPrompt,
  DEFAULT_CHAT_MODEL,
} from "../src/lib/rag";
import questions from "./questions.json";

// Judge model. See src/app/api/eval/route.ts for the full rationale.
// Short version: cross-family (Claude judging mostly-OpenAI candidates)
// reduces same-family rating bias.
const JUDGE_MODEL = "anthropic/claude-sonnet-4.6";

interface EvalResult {
  id: number;
  question: string;
  answer: string;
  retrievedSources: string[];
  scores: {
    correct: boolean;
    complete: boolean;
    cites_source: boolean;
    no_hallucination: boolean;
  };
  reasoning: string;
  pass: boolean;
}

async function runQuestion(
  q: (typeof questions)[number]
): Promise<EvalResult> {
  const chunks = await retrieveRelevantChunks(q.question, 5, 0.5);
  const systemPrompt = buildSystemPrompt(chunks);

  const { text: answer } = await generateText({
    model: DEFAULT_CHAT_MODEL,
    system: systemPrompt,
    prompt: q.question,
  });

  // See src/app/api/eval/route.ts for the full rationale on the four
  // dimensions. Short version: correct vs complete are deliberately
  // separated — an answer can be true but missing required context.
  const judgePrompt = `You are evaluating a RAG system's answer about Clever developer documentation.

QUESTION: ${q.question}

EXPECTED ANSWER: ${q.expected_answer}

ACTUAL ANSWER: ${answer}

EVALUATION CRITERIA:
${q.criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

The criteria are written with "must" (required for correctness) vs "should" (required for completeness). Use that distinction.

RETRIEVED SOURCES: ${chunks.map((c) => c.url).join(", ") || "none"}
EXPECTED SOURCE URL CONTAINS: ${q.expected_source ?? "(none — assistant should decline to answer)"}

Score the answer with simple yes/no on four dimensions:
1. correct: Nothing in the answer is factually wrong. Partial-but-accurate is correct=true. (Maps to "must" criteria.)
2. complete: The answer covers all key points the question demands. True-but-missing-context is complete=false. (Maps to "should" criteria.)
3. cites_source: Does the answer reference or link to a source document?
4. no_hallucination: Does the answer avoid fabricating information not present in the retrieved sources?

Respond ONLY with this exact JSON (no markdown, no prose):
{"correct": true/false, "complete": true/false, "cites_source": true/false, "no_hallucination": true/false, "reasoning": "brief explanation"}`;

  const { text: judgeResponse } = await generateText({
    model: JUDGE_MODEL,
    prompt: judgePrompt,
  });

  let scores = {
    correct: false,
    complete: false,
    cites_source: false,
    no_hallucination: false,
  };
  let reasoning = "";

  try {
    const parsed = JSON.parse(
      judgeResponse.replace(/```json?\n?/g, "").replace(/```/g, "").trim()
    );
    scores = {
      correct: !!parsed.correct,
      complete: !!parsed.complete,
      cites_source: !!parsed.cites_source,
      no_hallucination: !!parsed.no_hallucination,
    };
    reasoning = parsed.reasoning ?? "";
  } catch {
    reasoning = `Judge parse error: ${judgeResponse.slice(0, 200)}`;
  }

  // A question passes if it gets the answer right AND doesn't hallucinate.
  // Completeness and citation are tracked separately — they're quality
  // signals but missing them doesn't make an answer dangerous the way
  // wrongness or hallucination does.
  const pass = scores.correct && scores.no_hallucination;

  return {
    id: q.id,
    question: q.question,
    answer: answer.slice(0, 500),
    retrievedSources: chunks.map((c) => c.url),
    scores,
    reasoning,
    pass,
  };
}

async function main() {
  console.log(`\n🧪 Running eval on ${questions.length} questions...\n`);

  const results: EvalResult[] = [];

  for (const q of questions) {
    process.stdout.write(`  Q${q.id}: ${q.question.slice(0, 60)}... `);
    const result = await runQuestion(q);
    results.push(result);
    console.log(result.pass ? "✅" : "❌");
    await new Promise((r) => setTimeout(r, 500));
  }

  const passing = results.filter((r) => r.pass).length;
  const correctCount = results.filter((r) => r.scores.correct).length;
  const completeCount = results.filter((r) => r.scores.complete).length;
  const citationCount = results.filter((r) => r.scores.cites_source).length;
  const noHallucinationCount = results.filter(
    (r) => r.scores.no_hallucination
  ).length;

  const pct = (n: number) => `${Math.round((n / results.length) * 100)}%`;

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  EVAL RESULTS`);
  console.log(`${"═".repeat(60)}`);
  console.log(`  Pass rate:        ${passing}/${results.length} (${pct(passing)})`);
  console.log(`  Correct:          ${correctCount}/${results.length} (${pct(correctCount)})`);
  console.log(`  Complete:         ${completeCount}/${results.length} (${pct(completeCount)})`);
  console.log(`  Cites source:     ${citationCount}/${results.length} (${pct(citationCount)})`);
  console.log(`  No hallucination: ${noHallucinationCount}/${results.length} (${pct(noHallucinationCount)})`);
  console.log(`${"═".repeat(60)}\n`);

  const failures = results.filter((r) => !r.pass);
  if (failures.length > 0) {
    console.log("  FAILURES:\n");
    for (const f of failures) {
      console.log(`  Q${f.id}: ${f.question}`);
      console.log(
        `    Scores: correct=${f.scores.correct} complete=${f.scores.complete} cites=${f.scores.cites_source} noHalluc=${f.scores.no_hallucination}`
      );
      console.log(`    Reason: ${f.reasoning}`);
      console.log(`    Answer: ${f.answer.slice(0, 200)}...`);
      console.log();
    }
  }

  const output = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passing,
      passRate: pct(passing),
      correct: correctCount,
      complete: completeCount,
      citationCount,
      noHallucinationCount,
    },
    results,
  };

  const fs = await import("fs");
  fs.writeFileSync("eval/results.json", JSON.stringify(output, null, 2));
  console.log("  Results written to eval/results.json\n");
}

main().catch((err) => {
  console.error("Eval failed:", err);
  process.exit(1);
});
