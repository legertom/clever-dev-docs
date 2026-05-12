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
    <div className="flex-1 overflow-y-auto bg-clever-light-blue/20">
      <header className="border-b border-clever-light-blue bg-white px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-xl font-[family-name:var(--font-heading)] text-clever-navy">
            Feedback queue
          </h1>
          <p className="text-sm text-clever-black/50 mt-1 font-[family-name:var(--font-body)]">
            Doc gaps and answer issues. The signal a docs/support team
            would triage.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Filter chips */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-clever-black/50 mr-1 font-[family-name:var(--font-body)]">Filter:</span>
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
          <div className="rounded-xl border border-clever-orange/30 bg-clever-orange/5 p-4 text-sm text-clever-orange font-[family-name:var(--font-body)]">
            Failed to load feedback: {error.message}
          </div>
        )}

        {rows.length === 0 && !error && (
          <div className="rounded-xl border border-clever-light-blue bg-white p-12 text-center text-clever-black/50 font-[family-name:var(--font-body)]">
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
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors font-[family-name:var(--font-body)] ${
        active
          ? "bg-clever-blue text-white"
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
    <article className="rounded-xl border border-clever-light-blue bg-white overflow-hidden font-[family-name:var(--font-body)]">
      <div className="px-5 py-3 border-b border-clever-light-blue bg-clever-light-blue/20 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-medium ${
              isLow
                ? "bg-clever-yellow/30 text-clever-orange"
                : "bg-clever-blue/10 text-clever-blue"
            }`}
          >
            {isLow ? "Low-confidence retrieval" : "User report"}
          </span>
          {isLow && row.top_similarity !== null && (
            <span className="text-clever-black/40 font-mono">
              top similarity: {row.top_similarity.toFixed(3)}
            </span>
          )}
        </div>
        <time className="text-clever-black/40" dateTime={row.created_at}>
          {dateStr}
        </time>
      </div>

      <div className="p-5 space-y-3">
        {row.query && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-clever-black/40 mb-1">
              Query
            </div>
            <p className="text-sm text-clever-navy">
              {row.query}
            </p>
          </div>
        )}

        {row.response && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-clever-black/40 mb-1">
              Response
            </div>
            <p className="text-sm text-clever-black/70 whitespace-pre-wrap line-clamp-6">
              {row.response}
            </p>
          </div>
        )}

        {row.user_note && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-clever-black/40 mb-1">
              User note
            </div>
            <p className="text-sm italic text-clever-black/70">
              &ldquo;{row.user_note}&rdquo;
            </p>
          </div>
        )}

        {row.retrieved_urls && row.retrieved_urls.length > 0 && (
          <details className="text-xs text-clever-black/50">
            <summary className="cursor-pointer hover:text-clever-navy transition-colors">
              {row.retrieved_urls.length} sources retrieved
            </summary>
            <ul className="mt-2 space-y-1 ml-4">
              {row.retrieved_urls.map((url, i) => (
                <li key={i}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-clever-blue hover:text-clever-navy transition-colors"
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
