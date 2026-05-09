/**
 * /feedback — admin viewer for the feedback table.
 *
 * Two signal types share the table:
 *   - low_confidence: server-logged whenever retrieval fell below the
 *     similarity threshold. Strongest signal of doc gaps.
 *   - user_report: explicit "flag for review" submissions from the chat
 *     UI. Strongest signal that a specific answer was unhelpful.
 *
 * In production this page would sit behind auth (e.g. Clerk + an
 * admin-role gate). For the take-home it's open — the data is signal
 * about doc gaps, not user PII.
 */

import { getSupabase } from "@/lib/supabase";

// Always fetch fresh on each request — the whole point is to see the
// latest feedback as it comes in, not a cached snapshot.
export const revalidate = 0;

interface FeedbackRow {
  id: number;
  kind: "low_confidence" | "user_report";
  query: string | null;
  response: string | null;
  user_note: string | null;
  retrieved_urls: string[] | null;
  top_similarity: number | null;
  created_at: string;
}

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const params = await searchParams;
  const kindFilter = params.kind === "low_confidence" || params.kind === "user_report"
    ? params.kind
    : null;

  const supabase = getSupabase();
  let query = supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (kindFilter) query = query.eq("kind", kindFilter);

  const { data, error } = await query;
  const rows = (data ?? []) as FeedbackRow[];

  // Counts for the filter chips. Two extra small queries; cheap enough
  // for an admin page that gets infrequent traffic.
  const [{ count: lowCount }, { count: reportCount }] = await Promise.all([
    supabase
      .from("feedback")
      .select("*", { count: "exact", head: true })
      .eq("kind", "low_confidence"),
    supabase
      .from("feedback")
      .select("*", { count: "exact", head: true })
      .eq("kind", "user_report"),
  ]);

  const totalCount = (lowCount ?? 0) + (reportCount ?? 0);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Feedback queue
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Doc gaps and answer issues. The signal a docs/support team
              would triage.
            </p>
          </div>
          <a
            href="/"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Back to chat
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Filter chips */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 mr-1">Filter:</span>
          <FilterLink
            href="/feedback"
            active={!kindFilter}
            label="All"
            count={totalCount}
          />
          <FilterLink
            href="/feedback?kind=low_confidence"
            active={kindFilter === "low_confidence"}
            label="Low-confidence retrievals"
            count={lowCount ?? 0}
          />
          <FilterLink
            href="/feedback?kind=user_report"
            active={kindFilter === "user_report"}
            label="User reports"
            count={reportCount ?? 0}
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
            Failed to load feedback: {error.message}
          </div>
        )}

        {rows.length === 0 && !error && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center text-zinc-500">
            No feedback {kindFilter ? `of type "${kindFilter}"` : "yet"}. Ask
            a question the docs can&apos;t answer, or use the &ldquo;Flag for
            review&rdquo; button on a chat response, and it will show up here.
          </div>
        )}

        <div className="space-y-3">
          {rows.map((row) => (
            <FeedbackCard key={row.id} row={row} />
          ))}
        </div>
      </main>
    </div>
  );
}

function FilterLink({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white"
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
    </a>
  );
}

function FeedbackCard({ row }: { row: FeedbackRow }) {
  const isLow = row.kind === "low_confidence";
  const date = new Date(row.created_at);
  const dateStr = date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <article className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-medium ${
              isLow
                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
                : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
            }`}
          >
            {isLow ? "🔍 Low-confidence retrieval" : "🚩 User report"}
          </span>
          {isLow && row.top_similarity !== null && (
            <span className="text-zinc-500 font-mono">
              top similarity: {row.top_similarity.toFixed(3)}
            </span>
          )}
        </div>
        <time className="text-zinc-500" dateTime={row.created_at}>
          {dateStr}
        </time>
      </div>

      <div className="p-5 space-y-3">
        {row.query && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
              Query
            </div>
            <p className="text-sm text-zinc-900 dark:text-zinc-100">
              {row.query}
            </p>
          </div>
        )}

        {row.response && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
              Response
            </div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap line-clamp-6">
              {row.response}
            </p>
          </div>
        )}

        {row.user_note && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
              User note
            </div>
            <p className="text-sm italic text-zinc-700 dark:text-zinc-300">
              &ldquo;{row.user_note}&rdquo;
            </p>
          </div>
        )}

        {row.retrieved_urls && row.retrieved_urls.length > 0 && (
          <details className="text-xs text-zinc-500">
            <summary className="cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300">
              {row.retrieved_urls.length} sources retrieved
            </summary>
            <ul className="mt-2 space-y-1 ml-4">
              {row.retrieved_urls.map((url, i) => (
                <li key={i}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {url.replace("https://dev.clever.com", "")}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </article>
  );
}
