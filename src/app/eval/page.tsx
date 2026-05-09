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

interface Scores {
  correct: boolean;
  complete: boolean;
  cites_source: boolean;
  no_hallucination: boolean;
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
type Filter =
  | { kind: "all" }
  | { kind: "any-failure" }
  | { kind: "disagreement" }
  | {
      kind: "model-fail";
      model: Model;
      dimension: "correct" | "complete" | "cites_source" | "no_hallucination";
    };

export default function EvalPage() {
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [filter, setFilter] = useState<Filter>({ kind: "all" });

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
      }),
    });
    const data = await res.json();
    return {
      model,
      answer: data.answer ?? "ERROR",
      scores: data.scores ?? {
        correct: false,
        cites_source: false,
        no_hallucination: false,
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

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      // Run all models for this question in parallel
      const modelResults = await Promise.all(
        MODELS.map((m) => runQuestion(q, m))
      );
      setResults((prev) => [
        ...prev,
        { questionId: q.id, question: q.question, results: modelResults },
      ]);
      setProgress({ current: i + 1, total: questions.length });
    }

    setRunning(false);
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
            !r.scores.no_hallucination
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
      avgDurationMs: Math.round(
        modelResults.reduce((s, r) => s + r.durationMs, 0) / modelResults.length
      ),
      totalCost,
      avgCost: totalCost / modelResults.length,
    };
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              RAG Evaluation
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {questions.length} test questions × {MODELS.length} models ={" "}
              {questions.length * MODELS.length} runs
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              ← Back to chat
            </a>
            <button
              onClick={runEval}
              disabled={running}
              className="rounded-lg bg-blue-600 px-5 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {running
                ? `Running ${progress.current}/${progress.total}...`
                : "Run Eval"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Summary scoreboard */}
        {results.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {summary.map((s) => (
                <div
                  key={s.model}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {s.model}
                    </h3>
                    <div className="text-xs text-zinc-500 text-right">
                      <div>avg {s.avgDurationMs}ms</div>
                      <div>
                        total{" "}
                        <span className="font-mono">
                          {formatCost(s.totalCost)}
                        </span>{" "}
                        · avg{" "}
                        <span className="font-mono">
                          {formatCost(s.avgCost)}
                        </span>
                        /q
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Metric
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
                    <Metric
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
                    <Metric
                      label="Cites source"
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
                    <Metric
                      label="No hallucination"
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
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {results.length === 0 && !running && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
              Compare RAG quality across models
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-2xl mx-auto">
              Each test question is run through the full RAG pipeline (retrieve
              → generate) using {MODELS.length} different models, then scored
              by Claude Sonnet 4.6 as judge on four dimensions:{" "}
              <strong>correct</strong> (no factual errors),{" "}
              <strong>complete</strong> (covers required points),{" "}
              <strong>cites source</strong>, and{" "}
              <strong>no hallucination</strong>.
            </p>
            <p className="text-sm text-zinc-400">
              Click <strong>Run Eval</strong> to start. Takes ~1-2 minutes for{" "}
              {questions.length * MODELS.length} runs.
            </p>
          </div>
        )}

        {/* Filter chips */}
        {results.length > 0 && (
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs text-zinc-500 mr-1">Filter:</span>
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
            <FilterChip
              label="Models disagreed"
              count={filterCounts.disagreement}
              active={filter.kind === "disagreement"}
              onClick={() => setFilter({ kind: "disagreement" })}
              disabled={filterCounts.disagreement === 0}
            />
            {filter.kind === "model-fail" && (
              // Show the active model-fail filter as a removable chip
              // since it's not part of the static chip set.
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
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center text-zinc-500">
            No questions match this filter.{" "}
            <button
              onClick={() => setFilter({ kind: "all" })}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear filter
            </button>
          </div>
        )}

        {/* Per-question results */}
        {visibleResults.map((r) => (
          <section
            key={r.questionId}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              <div className="flex items-baseline gap-3">
                <span className="text-xs font-mono text-zinc-400">
                  Q{r.questionId}
                </span>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                  {r.question}
                </h3>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800">
              {r.results.map((mr) => (
                <div key={mr.model} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs text-zinc-500">
                      {mr.model}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">
                      {mr.durationMs}ms · {formatCost(mr.usage.cost)} ·{" "}
                      {mr.usage.inputTokens}↓ {mr.usage.outputTokens}↑
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
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
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none mb-3 text-zinc-700 dark:text-zinc-300 [&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:underline [&_table]:text-xs [&_th]:bg-zinc-100 dark:[&_th]:bg-zinc-800 [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_td]:border [&_th]:border-zinc-300 [&_td]:border-zinc-300 dark:[&_th]:border-zinc-700 dark:[&_td]:border-zinc-700">
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
                    <p className="text-xs text-zinc-500 italic mb-3">
                      Judge: {mr.scores.reasoning}
                    </p>
                  )}
                  {mr.sources.length > 0 && (
                    <details className="text-xs text-zinc-500">
                      <summary className="cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300">
                        {mr.sources.length} sources retrieved
                      </summary>
                      <ul className="mt-2 space-y-1 ml-4">
                        {mr.sources.map((s, i) => (
                          <li key={i}>
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {s.title}
                            </a>{" "}
                            <span className="text-zinc-400">
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

function Metric({
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
  const color =
    pct >= 80
      ? "text-green-600 dark:text-green-400"
      : pct >= 60
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";
  const failures = total - value;
  return (
    <div>
      <div className={`text-2xl font-semibold ${color}`}>{pct}%</div>
      <div className="text-xs text-zinc-500 mt-1">
        {label} ({value}/{total})
        {onClickFailures && failures > 0 && (
          <button
            onClick={onClickFailures}
            className="ml-2 text-blue-600 dark:text-blue-400 hover:underline"
            title={`Filter to the ${failures} failure${failures === 1 ? "" : "s"}`}
          >
            see {failures}
          </button>
        )}
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
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : disabled
            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
      }`}
    >
      <span>{label}</span>
      <span
        className={`text-[10px] px-1.5 rounded-full ${
          active
            ? "bg-white/20"
            : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
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
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
        value
          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
          : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
      }`}
    >
      {value ? "✓" : "✗"} {label}
    </span>
  );
}
