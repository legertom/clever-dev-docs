import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — Clever Dev Docs Assistant",
  description:
    "How this RAG-powered assistant works: architecture, design decisions, and production thinking.",
};

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
              C
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                About
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                How this assistant works
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Chat
            </Link>
            <Link
              href="/eval"
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Eval
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-12">
        <article className="max-w-3xl mx-auto space-y-12">
          {/* Intro */}
          <section>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              What this is
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              A RAG-powered assistant that answers natural-language questions
              about the Clever developer platform — Library, SSO,
              certification, the API — grounded in the official docs at{" "}
              <a
                href="https://dev.clever.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 underline"
              >
                dev.clever.com
              </a>
              . Every answer cites its source. When the system isn&apos;t
              confident, it says so rather than guessing.
            </p>
          </section>

          {/* Audience */}
          <section>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Who it&apos;s for
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Independent developers integrating with Clever Library — often
              solo builders shipping a classroom app, going through
              certification, working at 11pm without access to a human support
              agent. The existing support widget routes through a decision tree;
              this gives them answers directly from the docs, instantly.
            </p>
          </section>

          {/* Architecture */}
          <section>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              How it works
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card
                title="Retrieval"
                body="Your question is embedded and matched against 86 pages of Clever docs via pgvector cosine similarity search. The top chunks become the model's context."
              />
              <Card
                title="Generation"
                body="The AI SDK streams a completion through the Vercel AI Gateway. The model sees only retrieved docs — no memorized knowledge about Clever."
              />
              <Card
                title="Confidence gate"
                body="Below 0.6 similarity on retrieval, the system prompt switches modes: the model admits uncertainty instead of improvising. Wrong answers about certification requirements are more expensive than 'I don't know.'"
              />
              <Card
                title="Audience routing"
                body="The full corpus is indexed — including Secure Sync and LMS Connect — but the prompt routes developers to the right path. Indie devs get pointed toward Library; enterprise paths surface a note about contacting Clever."
              />
            </div>
          </section>

          {/* Key decisions */}
          <section>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Design decisions
            </h2>
            <dl className="space-y-4">
              <DecisionItem
                term="gpt-4o-mini over a flagship model"
                definition="At ~$0.0003 per query, the cheap model handles factual lookups where retrieval does the heavy lifting. The eval shows exactly which questions need a smarter model."
              />
              <DecisionItem
                term="AI Gateway over provider SDKs"
                definition="One auth mechanism, one observability surface, zero code changes to swap providers. The eval page compares OpenAI and Anthropic models with a string change."
              />
              <DecisionItem
                term="pgvector over a dedicated vector DB"
                definition="For ~200 chunks, Postgres with HNSW is sub-100ms, operationally simpler, and one less service to monitor. Migration point: when you need hybrid search at scale."
              />
              <DecisionItem
                term="Live eval as a product page"
                definition="Not just a CI script. Putting the eval in the app means you can see what the system is actually doing — cost per query, cross-provider comparison, rubric scores — right now."
              />
            </dl>
          </section>

          {/* Production thinking */}
          <section>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Production thinking
            </h2>
            <ul className="space-y-2 text-zinc-600 dark:text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1.5 shrink-0">&#8226;</span>
                <span>
                  <strong className="text-zinc-900 dark:text-zinc-100">
                    Re-ingestion:
                  </strong>{" "}
                  content-hash chunks, only re-embed what changed. A daily cron
                  polls the sitemap for diffs.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1.5 shrink-0">&#8226;</span>
                <span>
                  <strong className="text-zinc-900 dark:text-zinc-100">
                    Low-confidence queue:
                  </strong>{" "}
                  every &quot;I couldn&apos;t find it&quot; gets logged — the
                  strongest signal of doc gaps the support team should see.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1.5 shrink-0">&#8226;</span>
                <span>
                  <strong className="text-zinc-900 dark:text-zinc-100">
                    Rate limiting:
                  </strong>{" "}
                  public endpoints with LLM calls behind them get expensive fast
                  under abuse.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1.5 shrink-0">&#8226;</span>
                <span>
                  <strong className="text-zinc-900 dark:text-zinc-100">
                    Eval in CI:
                  </strong>{" "}
                  the test suite gates PRs on pass-rate, preventing silent
                  regressions when prompts or models change.
                </span>
              </li>
            </ul>
          </section>

          {/* Stack */}
          <section>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Stack
            </h2>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Layer</th>
                    <th className="px-4 py-2.5 font-medium">Choice</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-700 dark:text-zinc-300 divide-y divide-zinc-100 dark:divide-zinc-800">
                  <tr>
                    <td className="px-4 py-2.5">Framework</td>
                    <td className="px-4 py-2.5">Next.js App Router</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5">AI</td>
                    <td className="px-4 py-2.5">
                      Vercel AI SDK v6 + AI Gateway
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5">Default model</td>
                    <td className="px-4 py-2.5">
                      <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                        openai/gpt-4o-mini
                      </code>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5">Embeddings</td>
                    <td className="px-4 py-2.5">
                      <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                        openai/text-embedding-3-small
                      </code>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5">Vector store</td>
                    <td className="px-4 py-2.5">
                      Supabase Postgres + pgvector (Vercel Marketplace)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5">Hosting</td>
                    <td className="px-4 py-2.5">Vercel (Fluid Compute)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </article>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <p className="max-w-3xl mx-auto text-xs text-zinc-400 text-center">
          Built by Tom Leger as a Vercel Solutions Architect take-home (Track B:
          AI Cloud).
        </p>
      </footer>
    </div>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
      <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">
        {title}
      </h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
        {body}
      </p>
    </div>
  );
}

function DecisionItem({
  term,
  definition,
}: {
  term: string;
  definition: string;
}) {
  return (
    <div>
      <dt className="font-medium text-zinc-900 dark:text-zinc-100">{term}</dt>
      <dd className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
        {definition}
      </dd>
    </div>
  );
}
