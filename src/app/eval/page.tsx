"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import questions from "../../../eval/questions.json";

// Three-way comparison demonstrates the AI Gateway value prop:
// switching models — including across providers — is a string change.
const MODELS = [
  "openai/gpt-4o-mini",
  "openai/gpt-5.4",
  "anthropic/claude-haiku-4.5",
] as const;
type Model = (typeof MODELS)[number];

// Worker-pool concurrency for the eval. Each "worker" pulls the next
// question and runs its 3 model calls in parallel. So effective
// concurrency at the LLM call level is CONCURRENCY × MODELS.length.
//
// Why 5: 5 × 3 = 15 simultaneous LLM calls. Well under AI Gateway's
// per-key rate limits (typically 100+ RPM) and under any reasonable
// browser HTTP/2 connection cap. Pushing higher gives diminishing
// returns once we're bottlenecked by the slowest individual call.
const CONCURRENCY = 5;

const MODEL_THEMES: Record<Model, string> = {
  "openai/gpt-4o-mini": "#3b82f6",
  "openai/gpt-5.4": "#8b5cf6",
  "anthropic/claude-haiku-4.5": "#f59e0b",
};

interface Scores {
  correct: boolean;
  complete: boolean;
  cites_source: boolean;
  no_hallucination: boolean;
  formatting: boolean;
  reasoning: string;
}

interface Source {
  url: string;
  title: string;
  similarity: number;
}

interface Usage {
  inputTokens: number;
  outputTokens: number;
  cost: number; // USD
}

interface ModelResult {
  model: Model;
  answer: string;
  scores: Scores;
  sources: Source[];
  durationMs: number;
  usage: Usage;
}

interface QuestionResult {
  questionId: number;
  question: string;
  results: ModelResult[];
}

// Filter that selects which subset of question results to display.
// "model:dimension" format lets us key per-model failures (e.g.
// "openai/gpt-4o-mini:correct" = questions where this model failed
// the correctness check).
type Dimension = "correct" | "complete" | "cites_source" | "no_hallucination" | "formatting";

const DIMENSION_LABELS: Record<Dimension, string> = {
  correct: "Incorrect",
  complete: "Incomplete",
  cites_source: "Missing cites",
  no_hallucination: "Hallucinated",
  formatting: "Bad format",
};

type Filter =
  | { kind: "all" }
  | { kind: "any-failure" }
  | { kind: "disagreement" }
  | { kind: "dimension-fail"; dimension: Dimension }
  | { kind: "model-fail"; model: Model; dimension: Dimension };

export default function EvalPage() {
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [saving, setSaving] = useState(false);
  const [savedRunId, setSavedRunId] = useState<string | null>(null);
  const [saveLabel, setSaveLabel] = useState("");
  const [retrievalMode, setRetrievalMode] = useState<"hybrid" | "vector">(
    "hybrid"
  );

  async function runQuestion(
    q: (typeof questions)[number],
    model: Model
  ): Promise<ModelResult> {
    const start = Date.now();
    const res = await fetch("/api/eval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: q.question,
        expected_answer: q.expected_answer,
        criteria: q.criteria,
        expected_source: q.expected_source,
        model,
        retrievalMode,
      }),
    });
    const data = await res.json();
    return {
      model,
      answer: data.answer ?? "ERROR",
      scores: data.scores ?? {
        correct: false,
        complete: false,
        cites_source: false,
        no_hallucination: false,
        formatting: false,
        reasoning: "request failed",
      },
      sources: data.sources ?? [],
      durationMs: Date.now() - start,
      usage: data.usage ?? { inputTokens: 0, outputTokens: 0, cost: 0 },
    };
  }

  async function runEval() {
    setRunning(true);
    setResults([]);
    setProgress({ current: 0, total: questions.length });

    // Worker pool: shared index counter, each worker pulls the next
    // question. As each completes its 3-model fan-out, results are
    // inserted into state in question-id order regardless of completion
    // order — so the rendered list never shuffles even though work is
    // happening out of order.
    let nextIndex = 0;
    let completed = 0;

    async function worker(): Promise<void> {
      while (true) {
        const i = nextIndex++;
        if (i >= questions.length) return;

        const q = questions[i];
        const modelResults = await Promise.all(
          MODELS.map((m) => runQuestion(q, m))
        );

        setResults((prev) =>
          [
            ...prev,
            {
              questionId: q.id,
              question: q.question,
              results: modelResults,
            },
          ].sort((a, b) => a.questionId - b.questionId)
        );

        completed += 1;
        setProgress({ current: completed, total: questions.length });
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, questions.length) }, () =>
        worker()
      )
    );

    setRunning(false);
    setSavedRunId(null);
  }

  async function saveRun() {
    setSaving(true);
    try {
      const evalResults = results.flatMap((qr) =>
        qr.results.map((mr) => ({
          question_id: qr.questionId,
          question: qr.question,
          model: mr.model,
          answer: mr.answer,
          correct: mr.scores.correct,
          complete: mr.scores.complete,
          cites_source: mr.scores.cites_source,
          no_hallucination: mr.scores.no_hallucination,
          formatting: mr.scores.formatting,
          reasoning: mr.scores.reasoning,
          retrieved_urls: mr.sources.map((s) => s.url),
          top_similarity: mr.sources[0]?.similarity ?? 0,
          duration_ms: mr.durationMs,
          cost_usd: mr.usage.cost,
          input_tokens: mr.usage.inputTokens,
          output_tokens: mr.usage.outputTokens,
        }))
      );

      const res = await fetch("/api/eval/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: saveLabel || null,
          results: evalResults,
          chunkConfig: {
            match_count: 5,
            match_threshold: 0.5,
            retrieval_mode: retrievalMode,
          },
        }),
      });
      const data = await res.json();
      if (data.id) setSavedRunId(data.id);
    } finally {
      setSaving(false);
    }
  }

  // ── Filter predicates ──────────────────────────────────────
  // Each returns true if the question result matches the filter.
  // Computed lazily so we can also surface "X of N" counts on chips.
  function matchesFilter(qr: QuestionResult, f: Filter): boolean {
    switch (f.kind) {
      case "all":
        return true;
      case "any-failure":
        return qr.results.some(
          (r) =>
            !r.scores.correct ||
            !r.scores.complete ||
            !r.scores.cites_source ||
            !r.scores.no_hallucination ||
            !r.scores.formatting
        );
      case "disagreement": {
        // Models disagree on correctness. The most demo-worthy filter:
        // surfaces the questions where the cheap-vs-flagship trade-off
        // actually mattered.
        const correctnessSet = new Set(
          qr.results.map((r) => r.scores.correct)
        );
        return correctnessSet.size > 1;
      }
      case "dimension-fail":
        return qr.results.some((r) => !r.scores[f.dimension]);
      case "model-fail":
        return qr.results.some(
          (r) => r.model === f.model && !r.scores[f.dimension]
        );
    }
  }

  const visibleResults = results.filter((r) => matchesFilter(r, filter));

  const filterCounts = {
    all: results.length,
    "any-failure": results.filter((r) => matchesFilter(r, { kind: "any-failure" })).length,
    correct: results.filter((r) => matchesFilter(r, { kind: "dimension-fail", dimension: "correct" })).length,
    complete: results.filter((r) => matchesFilter(r, { kind: "dimension-fail", dimension: "complete" })).length,
    cites_source: results.filter((r) => matchesFilter(r, { kind: "dimension-fail", dimension: "cites_source" })).length,
    no_hallucination: results.filter((r) => matchesFilter(r, { kind: "dimension-fail", dimension: "no_hallucination" })).length,
    formatting: results.filter((r) => matchesFilter(r, { kind: "dimension-fail", dimension: "formatting" })).length,
    disagreement: results.filter((r) => matchesFilter(r, { kind: "disagreement" })).length,
  };

  // ── Aggregate scores per model ─────────────────────────────
  const summary = MODELS.map((model) => {
    const modelResults = results.flatMap((r) =>
      r.results.filter((mr) => mr.model === model)
    );
    if (modelResults.length === 0) {
      return {
        model,
        total: 0,
        correct: 0,
        complete: 0,
        cites_source: 0,
        no_hallucination: 0,
        formatting: 0,
        avgDurationMs: 0,
        totalCost: 0,
        avgCost: 0,
      };
    }
    const totalCost = modelResults.reduce((s, r) => s + r.usage.cost, 0);
    return {
      model,
      total: modelResults.length,
      correct: modelResults.filter((r) => r.scores.correct).length,
      complete: modelResults.filter((r) => r.scores.complete).length,
      cites_source: modelResults.filter((r) => r.scores.cites_source).length,
      no_hallucination: modelResults.filter((r) => r.scores.no_hallucination)
        .length,
      formatting: modelResults.filter((r) => r.scores.formatting).length,
      avgDurationMs: Math.round(
        modelResults.reduce((s, r) => s + r.durationMs, 0) / modelResults.length
      ),
      totalCost,
      avgCost: totalCost / modelResults.length,
    };
  });

  const maxDuration = Math.max(...summary.map((s) => s.avgDurationMs), 1);
  const maxCost = Math.max(...summary.map((s) => s.totalCost), 0.0001);

  return (
    <div className="flex-1 overflow-y-auto bg-clever-light-blue/20">
      <header className="border-b border-clever-light-blue bg-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-[family-name:var(--font-heading)] text-clever-navy">
              RAG Evaluation
            </h1>
            <p className="text-sm text-clever-black/50 mt-1 font-[family-name:var(--font-body)]">
              {questions.length} test questions × {MODELS.length} models ={" "}
              {questions.length * MODELS.length} runs
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/eval/history"
              className="text-sm text-clever-blue hover:text-clever-navy transition-colors font-[family-name:var(--font-body)]"
            >
              History
            </a>
            <div
              role="radiogroup"
              aria-label="Retrieval mode"
              className="inline-flex rounded-lg border border-clever-light-blue overflow-hidden font-[family-name:var(--font-body)]"
              title="Which retrieval strategy each question runs through"
            >
              {(["hybrid", "vector"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={retrievalMode === m}
                  onClick={() => setRetrievalMode(m)}
                  disabled={running}
                  className={`px-3 py-2 text-xs capitalize transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    retrievalMode === m
                      ? "bg-clever-blue text-white"
                      : "bg-white text-clever-navy hover:bg-clever-light-blue/40"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              onClick={runEval}
              disabled={running}
              className="rounded-xl bg-clever-blue px-5 py-2 text-white font-medium hover:bg-clever-navy disabled:opacity-50 transition-colors font-[family-name:var(--font-body)]"
            >
              {running
                ? `Running ${progress.current}/${progress.total}...`
                : "Run Eval"}
            </button>
          </div>
        </div>
        {running && (
          <div className="border-t border-clever-light-blue -mx-6 px-6 pt-3">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-clever-light-blue/50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-clever-blue"
                    style={{
                      width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                      transition: "width 0.4s ease-out",
                    }}
                  />
                </div>
                <span className="text-xs font-mono text-clever-black/50 shrink-0">
                  {progress.current}/{progress.total} questions
                </span>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Summary scoreboard */}
        {results.length > 0 && (
          <section>
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-clever-navy mb-4">
              Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary.map((s) => {
                const accent = MODEL_THEMES[s.model];
                const speedPct =
                  (s.avgDurationMs / maxDuration) * 100;
                const costPct =
                  (s.totalCost / maxCost) * 100;
                return (
                  <div
                    key={s.model}
                    className="rounded-xl border border-clever-light-blue bg-white overflow-hidden"
                  >
                    <div
                      className="h-1"
                      style={{ background: accent }}
                    />
                    <div className="relative p-5">
                      <div
                        className="absolute inset-0 opacity-[0.04] pointer-events-none"
                        style={{
                          background: `linear-gradient(135deg, ${accent}, transparent)`,
                        }}
                      />
                      <div className="relative">
                        <div className="flex items-center justify-between mb-5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ background: accent }}
                            />
                            <h3 className="font-mono text-sm font-medium text-clever-navy">
                              {s.model}
                            </h3>
                          </div>
                          <span className="text-[11px] text-clever-black/40 font-mono">
                            {formatCost(s.avgCost)}/q
                          </span>
                        </div>

                        <div className="flex items-start justify-around mb-5">
                          <RingMetric
                            label="Correct"
                            value={s.correct}
                            total={s.total}
                            onClickFailures={
                              s.correct < s.total
                                ? () =>
                                    setFilter({
                                      kind: "model-fail",
                                      model: s.model,
                                      dimension: "correct",
                                    })
                                : undefined
                            }
                          />
                          <RingMetric
                            label="Complete"
                            value={s.complete}
                            total={s.total}
                            onClickFailures={
                              s.complete < s.total
                                ? () =>
                                    setFilter({
                                      kind: "model-fail",
                                      model: s.model,
                                      dimension: "complete",
                                    })
                                : undefined
                            }
                          />
                          <RingMetric
                            label="Cites src"
                            value={s.cites_source}
                            total={s.total}
                            onClickFailures={
                              s.cites_source < s.total
                                ? () =>
                                    setFilter({
                                      kind: "model-fail",
                                      model: s.model,
                                      dimension: "cites_source",
                                    })
                                : undefined
                            }
                          />
                          <RingMetric
                            label="No halluc."
                            value={s.no_hallucination}
                            total={s.total}
                            onClickFailures={
                              s.no_hallucination < s.total
                                ? () =>
                                    setFilter({
                                      kind: "model-fail",
                                      model: s.model,
                                      dimension: "no_hallucination",
                                    })
                                : undefined
                            }
                          />
                          <RingMetric
                            label="Format"
                            value={s.formatting}
                            total={s.total}
                            onClickFailures={
                              s.formatting < s.total
                                ? () =>
                                    setFilter({
                                      kind: "model-fail",
                                      model: s.model,
                                      dimension: "formatting",
                                    })
                                : undefined
                            }
                          />
                        </div>

                        <div className="space-y-2.5 pt-4 border-t border-clever-light-blue">
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-clever-black/40 w-10">
                              Speed
                            </span>
                            <div className="flex-1 h-1.5 bg-clever-light-blue/50 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${speedPct}%`,
                                  background: accent,
                                  transition: "width 0.5s ease-out",
                                }}
                              />
                            </div>
                            <span className="text-[11px] font-mono text-clever-black/50 w-14 text-right">
                              {(s.avgDurationMs / 1000).toFixed(1)}s
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-clever-black/40 w-10">
                              Cost
                            </span>
                            <div className="flex-1 h-1.5 bg-clever-light-blue/50 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${costPct}%`,
                                  background: accent,
                                  transition: "width 0.5s ease-out",
                                }}
                              />
                            </div>
                            <span className="text-[11px] font-mono text-clever-black/50 w-14 text-right">
                              {formatCost(s.totalCost)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Save run to DB */}
        {results.length > 0 && !running && (
          <div className="rounded-xl border border-clever-light-blue bg-white p-5 flex items-center gap-4">
            <input
              type="text"
              value={saveLabel}
              onChange={(e) => setSaveLabel(e.target.value)}
              placeholder="Label this run (e.g. &quot;increased chunk overlap to 300&quot;)"
              className="flex-1 text-sm border border-clever-light-blue rounded-lg px-3 py-2 text-clever-navy placeholder:text-clever-black/30 focus:outline-none focus:ring-2 focus:ring-clever-blue/30 font-[family-name:var(--font-body)]"
            />
            {savedRunId ? (
              <span className="text-sm text-green-600 font-medium font-[family-name:var(--font-body)]">
                Saved! <a href="/eval/history" className="text-clever-blue hover:text-clever-navy underline">View history</a>
              </span>
            ) : (
              <button
                onClick={saveRun}
                disabled={saving}
                className="rounded-xl bg-clever-navy px-5 py-2 text-white font-medium hover:bg-clever-blue disabled:opacity-50 transition-colors text-sm shrink-0 font-[family-name:var(--font-body)]"
              >
                {saving ? "Saving..." : "Save to DB"}
              </button>
            )}
          </div>
        )}

        {/* Loading illustration */}
        {running && results.length === 0 && (
          <div className="rounded-xl border border-clever-light-blue bg-white p-16 flex flex-col items-center">
            <div className="relative w-36 h-36 mb-8">
              <div
                className="absolute inset-0 animate-spin"
                style={{ animationDuration: "3s" }}
              >
                <svg viewBox="0 0 144 144" className="w-full h-full">
                  <circle
                    cx="72"
                    cy="72"
                    r="62"
                    stroke="#1464FF"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={2 * Math.PI * 62}
                    strokeDashoffset={2 * Math.PI * 62 * 0.65}
                    strokeLinecap="round"
                    opacity="0.75"
                  />
                </svg>
              </div>
              <div
                className="absolute inset-0 animate-spin"
                style={{
                  animationDuration: "2.5s",
                  animationDirection: "reverse",
                }}
              >
                <svg viewBox="0 0 144 144" className="w-full h-full">
                  <circle
                    cx="72"
                    cy="72"
                    r="48"
                    stroke="#8b5cf6"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={2 * Math.PI * 48}
                    strokeDashoffset={2 * Math.PI * 48 * 0.6}
                    strokeLinecap="round"
                    opacity="0.75"
                  />
                </svg>
              </div>
              <div
                className="absolute inset-0 animate-spin"
                style={{ animationDuration: "2s" }}
              >
                <svg viewBox="0 0 144 144" className="w-full h-full">
                  <circle
                    cx="72"
                    cy="72"
                    r="34"
                    stroke="#f59e0b"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={2 * Math.PI * 34}
                    strokeDashoffset={2 * Math.PI * 34 * 0.55}
                    strokeLinecap="round"
                    opacity="0.75"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-clever-navy mb-2">
              Evaluating models...
            </h2>
            <p className="text-sm text-clever-black/50 text-center max-w-md font-[family-name:var(--font-body)]">
              Retrieving documents, generating answers, and scoring results
              with Claude Sonnet 4.6 as judge
            </p>
          </div>
        )}

        {/* Empty state */}
        {results.length === 0 && !running && (
          <div className="rounded-xl border border-clever-light-blue bg-white p-12 text-center">
            <h2 className="text-2xl font-[family-name:var(--font-heading)] text-clever-navy mb-3">
              Compare RAG quality across models
            </h2>
            <p className="text-clever-black/50 mb-6 max-w-2xl mx-auto font-[family-name:var(--font-body)]">
              Each test question is run through the full RAG pipeline (retrieve
              then generate) using {MODELS.length} different models, then scored
              by Claude Sonnet 4.6 as judge on five dimensions:{" "}
              <strong className="text-clever-navy">correct</strong> (no factual errors),{" "}
              <strong className="text-clever-navy">complete</strong> (covers required points),{" "}
              <strong className="text-clever-navy">cites source</strong>,{" "}
              <strong className="text-clever-navy">no hallucination</strong>, and{" "}
              <strong className="text-clever-navy">formatting</strong> (valid markdown).
            </p>
            <button
              onClick={runEval}
              className="inline-flex items-center gap-2 rounded-xl bg-clever-blue hover:bg-clever-navy text-white text-base font-medium px-6 py-3 transition-colors font-[family-name:var(--font-body)]"
            >
              Run Eval
            </button>
            <p className="text-sm text-clever-black/40 mt-4 font-[family-name:var(--font-body)]">
              Takes ~30-60 seconds for {questions.length * MODELS.length} runs.
            </p>
          </div>
        )}

        {/* Filter chips */}
        {results.length > 0 && (
          <div className="flex items-center flex-wrap gap-x-2 gap-y-2">
            <span className="text-xs text-clever-black/50 mr-1 font-[family-name:var(--font-body)]">Filter:</span>
            <FilterChip
              label="All"
              count={filterCounts.all}
              active={filter.kind === "all"}
              onClick={() => setFilter({ kind: "all" })}
            />
            <FilterChip
              label="Any failure"
              count={filterCounts["any-failure"]}
              active={filter.kind === "any-failure"}
              onClick={() => setFilter({ kind: "any-failure" })}
              disabled={filterCounts["any-failure"] === 0}
            />
            <div className="w-px h-4 bg-clever-light-blue mx-1" />
            {(
              ["correct", "complete", "cites_source", "no_hallucination", "formatting"] as const
            ).map((dim) => (
              <FilterChip
                key={dim}
                label={DIMENSION_LABELS[dim]}
                count={filterCounts[dim]}
                active={
                  filter.kind === "dimension-fail" &&
                  filter.dimension === dim
                }
                onClick={() =>
                  setFilter({ kind: "dimension-fail", dimension: dim })
                }
                disabled={filterCounts[dim] === 0}
              />
            ))}
            <div className="w-px h-4 bg-clever-light-blue mx-1" />
            <FilterChip
              label="Models disagreed"
              count={filterCounts.disagreement}
              active={filter.kind === "disagreement"}
              onClick={() => setFilter({ kind: "disagreement" })}
              disabled={filterCounts.disagreement === 0}
            />
            {filter.kind === "model-fail" && (
              <FilterChip
                label={`${filter.model.split("/")[1]} failed ${filter.dimension.replace("_", " ")}`}
                count={visibleResults.length}
                active
                onClick={() => setFilter({ kind: "all" })}
                removable
              />
            )}
          </div>
        )}

        {/* Empty filter state */}
        {results.length > 0 && visibleResults.length === 0 && (
          <div className="rounded-xl border border-clever-light-blue bg-white p-8 text-center text-clever-black/50 font-[family-name:var(--font-body)]">
            No questions match this filter.{" "}
            <button
              onClick={() => setFilter({ kind: "all" })}
              className="text-clever-blue hover:text-clever-navy transition-colors"
            >
              Clear filter
            </button>
          </div>
        )}

        {/* Per-question results */}
        {visibleResults.map((r) => (
          <section
            key={r.questionId}
            className="rounded-xl border border-clever-light-blue bg-white overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-clever-light-blue bg-clever-light-blue/20">
              <div className="flex items-baseline gap-3">
                <span className="text-xs font-mono text-clever-black/40">
                  Q{r.questionId}
                </span>
                <h3 className="font-medium text-clever-navy font-[family-name:var(--font-body)]">
                  {r.question}
                </h3>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-clever-light-blue">
              {r.results.map((mr) => (
                <div key={mr.model} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-medium text-clever-navy">
                      {mr.model}
                    </span>
                    <span className="text-xs text-clever-black/40 font-mono">
                      {mr.durationMs}ms · {formatCost(mr.usage.cost)} ·{" "}
                      {mr.usage.inputTokens}↓ {mr.usage.outputTokens}↑
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <ScoreBadge label="correct" value={mr.scores.correct} />
                    <ScoreBadge label="complete" value={mr.scores.complete} />
                    <ScoreBadge
                      label="cites"
                      value={mr.scores.cites_source}
                    />
                    <ScoreBadge
                      label="no halluc."
                      value={mr.scores.no_hallucination}
                    />
                    <ScoreBadge
                      label="format"
                      value={mr.scores.formatting}
                    />
                  </div>
                  <div className="prose prose-sm max-w-none mb-3 text-clever-black [&_a]:text-clever-blue [&_a]:underline [&_strong]:text-clever-navy [&_table]:text-xs [&_th]:bg-clever-light-blue/40 [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_td]:border [&_th]:border-clever-light-blue [&_td]:border-clever-light-blue">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      components={{
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {mr.answer}
                    </ReactMarkdown>
                  </div>
                  {mr.scores.reasoning && (
                    <p className="text-xs text-clever-black/50 italic mb-3">
                      Judge: {mr.scores.reasoning}
                    </p>
                  )}
                  {mr.sources.length > 0 && (
                    <details className="text-xs text-clever-black/50">
                      <summary className="cursor-pointer hover:text-clever-navy transition-colors">
                        {mr.sources.length} sources retrieved
                      </summary>
                      <ul className="mt-2 space-y-1 ml-4">
                        {mr.sources.map((s, i) => (
                          <li key={i}>
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-clever-blue hover:text-clever-navy transition-colors"
                            >
                              {s.title}
                            </a>{" "}
                            <span className="text-clever-black/30">
                              (sim: {s.similarity.toFixed(2)})
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

function RingMetric({
  label,
  value,
  total,
  onClickFailures,
}: {
  label: string;
  value: number;
  total: number;
  onClickFailures?: () => void;
}) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  const r = 24;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const scoreColor =
    pct >= 80
      ? { stroke: "#4ECC97", text: "text-clever-green" }
      : pct >= 60
        ? { stroke: "#FFE478", text: "text-clever-orange" }
        : { stroke: "#F78239", text: "text-clever-orange" };
  const failures = total - value;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-16 h-16">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke="#DAEBFF"
            strokeWidth="5"
          />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={scoreColor.stroke}
            strokeWidth="5"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.7s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-bold ${scoreColor.text}`}>
            {pct}%
          </span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[11px] font-medium text-clever-navy">
          {label}
        </div>
        <div className="text-[10px] text-clever-black/40">
          {value}/{total}
          {onClickFailures && failures > 0 && (
            <>
              {" · "}
              <button
                onClick={onClickFailures}
                className="text-clever-blue hover:underline"
              >
                see {failures}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
  disabled,
  removable,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  removable?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors font-[family-name:var(--font-body)] ${
        active
          ? "bg-clever-blue text-white"
          : disabled
            ? "bg-clever-light-blue/30 text-clever-black/30 cursor-not-allowed"
            : "bg-white border border-clever-light-blue text-clever-navy hover:bg-clever-light-blue/50"
      }`}
    >
      <span>{label}</span>
      <span
        className={`text-[10px] px-1.5 rounded-full ${
          active
            ? "bg-white/20"
            : "bg-clever-light-blue text-clever-navy/60"
        }`}
      >
        {count}
      </span>
      {removable && active && <span className="ml-0.5">×</span>}
    </button>
  );
}

// Format cost for display. Per-question costs are tiny ($0.0001 - $0.005),
// so we show 4 decimals at the question level. The summary card shows
// totals which can reach cents — handled with conditional precision.
function formatCost(cost: number): string {
  if (cost === 0) return "$0";
  if (cost < 0.001) return `$${cost.toFixed(5)}`;
  if (cost < 1) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function ScoreBadge({ label, value }: { label: string; value: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${
        value
          ? "bg-clever-green/15 text-clever-green"
          : "bg-clever-orange/15 text-clever-orange"
      }`}
    >
      {value ? "✓" : "✗"} {label}
    </span>
  );
}
