import { listEvalRuns, type SavedEvalRun } from "@/lib/eval-runs";

export const dynamic = "force-dynamic";

type Dimension = "correct" | "complete" | "cites_source" | "no_hallucination" | "formatting" | "pass";

const DIMENSION_COLS: { key: Dimension; label: string }[] = [
  { key: "pass", label: "Pass" },
  { key: "correct", label: "Correct" },
  { key: "complete", label: "Complete" },
  { key: "cites_source", label: "Cites" },
  { key: "no_hallucination", label: "No halluc." },
  { key: "formatting", label: "Format" },
];

function getModelScore(
  run: SavedEvalRun,
  model: string,
  dim: Dimension
): number | null {
  const m = run.summary?.models?.[model];
  if (!m || m.total === 0) return null;
  return Math.round((m[dim] / m.total) * 100);
}

function getAllModels(runs: SavedEvalRun[]): string[] {
  const set = new Set<string>();
  for (const r of runs) {
    for (const m of r.models) set.add(m);
  }
  return [...set].sort();
}

function scoreColor(pct: number): string {
  if (pct >= 80) return "text-green-600";
  if (pct >= 60) return "text-yellow-600";
  return "text-red-600";
}

function scoreBg(pct: number): string {
  if (pct >= 80) return "bg-green-50";
  if (pct >= 60) return "bg-yellow-50";
  return "bg-red-50";
}

function TrendArrow({ runs, model, dim }: { runs: SavedEvalRun[]; model: string; dim: Dimension }) {
  const chronological = [...runs].reverse();
  if (chronological.length < 2) return null;

  const scores = chronological
    .map((r) => getModelScore(r, model, dim))
    .filter((s): s is number => s !== null);

  if (scores.length < 2) return null;

  const latest = scores[scores.length - 1];
  const previous = scores[scores.length - 2];
  const diff = latest - previous;

  if (diff === 0) return <span className="text-zinc-400 text-[10px] ml-1">=</span>;
  if (diff > 0)
    return <span className="text-green-500 text-[10px] ml-1">+{diff}</span>;
  return <span className="text-red-500 text-[10px] ml-1">{diff}</span>;
}

function Sparkline({ runs, model, dim }: { runs: SavedEvalRun[]; model: string; dim: Dimension }) {
  const chronological = [...runs].reverse();
  const scores = chronological
    .map((r) => getModelScore(r, model, dim))
    .filter((s): s is number => s !== null);

  if (scores.length < 2) return null;

  const w = 80;
  const h = 24;
  const min = Math.min(...scores, 0);
  const max = Math.max(...scores, 100);
  const range = max - min || 1;

  const points = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * w;
    const y = h - ((s - min) / range) * h;
    return `${x},${y}`;
  });

  const lastScore = scores[scores.length - 1];
  const color = lastScore >= 80 ? "#22c55e" : lastScore >= 60 ? "#eab308" : "#ef4444";

  return (
    <svg width={w} height={h} className="inline-block align-middle">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function EvalHistoryPage() {
  const runs = await listEvalRuns(50);
  const models = getAllModels(runs);

  return (
    <div className="min-h-screen bg-clever-light-blue/20">
      <header className="border-b border-clever-light-blue bg-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-[family-name:var(--font-heading)] text-clever-navy">
              Eval History
            </h1>
            <p className="text-sm text-clever-black/50 mt-1 font-[family-name:var(--font-body)]">
              {runs.length} saved runs — track score changes as you tune RAG
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/eval"
              className="text-sm text-clever-blue hover:text-clever-navy transition-colors font-[family-name:var(--font-body)]"
            >
              Run eval
            </a>
            <a
              href="/"
              className="text-sm text-clever-blue hover:text-clever-navy transition-colors font-[family-name:var(--font-body)]"
            >
              Back to chat
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {runs.length === 0 && (
          <div className="rounded-xl border border-clever-light-blue bg-white p-12 text-center">
            <h2 className="text-2xl font-[family-name:var(--font-heading)] text-clever-navy mb-3">
              No eval runs saved yet
            </h2>
            <p className="text-clever-black/50 mb-6 max-w-md mx-auto font-[family-name:var(--font-body)]">
              Run an eval from the{" "}
              <a href="/eval" className="text-clever-blue hover:text-clever-navy underline">
                eval page
              </a>{" "}
              and click &ldquo;Save to DB&rdquo; to start tracking scores over time.
            </p>
          </div>
        )}

        {/* Trend sparklines per model */}
        {runs.length >= 2 && models.map((model) => (
          <section key={model} className="rounded-xl border border-clever-light-blue bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-clever-light-blue bg-clever-light-blue/20">
              <h2 className="font-mono text-sm font-medium text-clever-navy">
                {model} — trend
              </h2>
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {DIMENSION_COLS.map(({ key, label }) => (
                <div key={key} className="text-center">
                  <div className="text-[11px] text-zinc-500 mb-1 font-[family-name:var(--font-body)]">{label}</div>
                  <Sparkline runs={runs} model={model} dim={key} />
                  <TrendArrow runs={runs} model={model} dim={key} />
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Runs table */}
        {runs.length > 0 && (
          <section className="rounded-xl border border-clever-light-blue bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-clever-light-blue bg-clever-light-blue/20">
              <h2 className="font-[family-name:var(--font-heading)] text-clever-navy">
                All runs
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-clever-light-blue text-left text-xs text-clever-black/50 font-[family-name:var(--font-body)]">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Label</th>
                    <th className="px-4 py-3 font-medium">Model</th>
                    <th className="px-4 py-3 font-medium">Questions</th>
                    {DIMENSION_COLS.map(({ key, label }) => (
                      <th key={key} className="px-4 py-3 font-medium text-center">
                        {label}
                      </th>
                    ))}
                    <th className="px-4 py-3 font-medium">Prompt</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.flatMap((run) => {
                    const modelKeys = Object.keys(run.summary?.models ?? {});
                    if (modelKeys.length === 0) {
                      return (
                        <tr key={run.id} className="border-b border-clever-light-blue/50">
                          <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                            {new Date(run.created_at).toLocaleDateString()}{" "}
                            {new Date(run.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="px-4 py-3 text-clever-navy font-[family-name:var(--font-body)]">
                            {run.label || <span className="text-zinc-400 italic">no label</span>}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs" colSpan={DIMENSION_COLS.length + 3}>
                            {run.models.join(", ")}
                          </td>
                        </tr>
                      );
                    }

                    return modelKeys.map((model, mi) => {
                      const m = run.summary.models[model];
                      return (
                        <tr
                          key={`${run.id}-${model}`}
                          className={`border-b border-clever-light-blue/50 ${mi > 0 ? "bg-zinc-50/50" : ""}`}
                        >
                          {mi === 0 && (
                            <>
                              <td
                                className="px-4 py-3 font-mono text-xs text-zinc-500"
                                rowSpan={modelKeys.length}
                              >
                                {new Date(run.created_at).toLocaleDateString()}{" "}
                                {new Date(run.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </td>
                              <td
                                className="px-4 py-3 text-clever-navy font-[family-name:var(--font-body)]"
                                rowSpan={modelKeys.length}
                              >
                                {run.label || <span className="text-zinc-400 italic">no label</span>}
                              </td>
                            </>
                          )}
                          <td className="px-4 py-3 font-mono text-xs">
                            {model.split("/")[1]}
                          </td>
                          <td className="px-4 py-3 text-center text-xs">
                            {m.total}
                          </td>
                          {DIMENSION_COLS.map(({ key }) => {
                            const pct = m.total > 0 ? Math.round((m[key] / m.total) * 100) : 0;
                            return (
                              <td key={key} className={`px-4 py-3 text-center font-mono text-xs font-medium ${scoreColor(pct)} ${scoreBg(pct)}`}>
                                {pct}%
                                <span className="text-[10px] text-zinc-400 ml-0.5">
                                  ({m[key]}/{m.total})
                                </span>
                              </td>
                            );
                          })}
                          {mi === 0 && (
                            <td
                              className="px-4 py-3 font-mono text-[10px] text-zinc-400"
                              rowSpan={modelKeys.length}
                            >
                              {run.system_prompt_hash?.slice(0, 8) ?? "-"}
                            </td>
                          )}
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
