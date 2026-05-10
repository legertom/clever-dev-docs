import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — Clever Dev Docs Assistant",
  description:
    "How this RAG-powered assistant works: architecture, design decisions, and production thinking.",
};

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Hero header with navy background */}
      <header className="bg-clever-navy px-6 pt-6 pb-16 relative overflow-hidden">
        {/* Decorative brand shapes */}
        <div className="absolute top-8 right-12 w-48 h-48 bg-clever-blue/20 clever-blob-1" aria-hidden="true" />
        <div className="absolute -bottom-8 right-1/3 w-32 h-32 bg-clever-green/15 clever-blob-2" aria-hidden="true" />
        <div className="absolute top-20 left-8 w-20 h-20 bg-clever-yellow/10 clever-blob-3" aria-hidden="true" />

        <div className="max-w-3xl mx-auto relative">
          <nav className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c3.87 0 7 3.13 7 7 0 1.93-.78 3.68-2.05 4.95l-1.41-1.41A5.014 5.014 0 0017 12c0-2.76-2.24-5-5-5v3L8 6l4-4v3z" fill="white" opacity="0.9"/>
                  <path d="M12 22C6.48 22 2 17.52 2 12h3c0 3.87 3.13 7 7 7v-3l4 4-4 4v-3z" fill="white"/>
                </svg>
              </div>
              <span className="text-white/80 text-sm font-[family-name:var(--font-body)]">Clever Dev Docs</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-sm font-medium text-white/70 hover:text-white transition-colors font-[family-name:var(--font-body)]"
              >
                Chat
              </Link>
              <Link
                href="/eval"
                className="text-sm font-medium text-white/70 hover:text-white transition-colors font-[family-name:var(--font-body)]"
              >
                Eval
              </Link>
            </div>
          </nav>

          <h1 className="text-4xl sm:text-5xl text-white font-normal font-[family-name:var(--font-heading)] leading-[0.95] mb-4">
            About this assistant
          </h1>
          <p className="text-lg text-white/60 max-w-lg font-[family-name:var(--font-body)] leading-relaxed">
            Architecture, design decisions, and the production thinking behind a RAG-powered docs assistant.
          </p>
        </div>
      </header>

      <main className="flex-1 px-6 -mt-6">
        <article className="max-w-3xl mx-auto space-y-12 pb-16">
          {/* Intro card overlapping the hero */}
          <section className="bg-white rounded-2xl border border-clever-light-blue p-8 shadow-sm">
            <h2 className="text-2xl text-clever-navy mb-4 font-[family-name:var(--font-heading)]">
              What this is
            </h2>
            <p className="text-clever-black/70 leading-relaxed font-[family-name:var(--font-body)]">
              A RAG-powered assistant that answers natural-language questions
              about the Clever developer platform — Library, SSO,
              certification, the API — grounded in the official docs at{" "}
              <a
                href="https://dev.clever.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-clever-blue hover:text-clever-navy underline transition-colors"
              >
                dev.clever.com
              </a>
              . Every answer cites its source. When the system isn&apos;t
              confident, it says so rather than guessing.
            </p>
          </section>

          {/* Audience */}
          <section>
            <h2 className="text-2xl text-clever-navy mb-4 font-[family-name:var(--font-heading)]">
              Who it&apos;s for
            </h2>
            <p className="text-clever-black/70 leading-relaxed font-[family-name:var(--font-body)]">
              Independent developers integrating with Clever Library — often
              solo builders shipping a classroom app, going through
              certification, working at 11pm without access to a human support
              agent. The existing support widget routes through a decision tree;
              this gives them answers directly from the docs, instantly.
            </p>
          </section>

          {/* Architecture */}
          <section>
            <h2 className="text-2xl text-clever-navy mb-4 font-[family-name:var(--font-heading)]">
              How it works
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card
                title="Retrieval"
                body="Your question is embedded and matched against 86 pages of Clever docs via pgvector cosine similarity search. The top chunks become the model's context."
                accent="bg-clever-blue"
              />
              <Card
                title="Generation"
                body="The AI SDK streams a completion through the Vercel AI Gateway. The model sees only retrieved docs — no memorized knowledge about Clever."
                accent="bg-clever-green"
              />
              <Card
                title="Confidence gate"
                body="Below 0.6 similarity on retrieval, the system prompt switches modes: the model admits uncertainty instead of improvising. Wrong answers about certification requirements are more expensive than 'I don't know.'"
                accent="bg-clever-orange"
              />
              <Card
                title="Audience routing"
                body="Every chunk is tagged with its integration path (Library, Secure Sync, LMS Connect, or general). When answers differ by path, the model presents both variants or asks which path the developer is on."
                accent="bg-clever-yellow"
              />
            </div>
          </section>

          {/* Ingestion pipeline */}
          <section>
            <h2 className="text-2xl text-clever-navy mb-3 font-[family-name:var(--font-heading)]">
              Building the knowledge base
            </h2>
            <p className="text-clever-black/70 leading-relaxed mb-4 font-[family-name:var(--font-body)]">
              The vector database is populated by a CLI script (<code className="text-xs bg-clever-light-blue/60 text-clever-navy px-1.5 py-0.5 rounded">pnpm ingest</code>) that
              scrapes, chunks, and embeds the Clever developer docs into Supabase
              Postgres with the pgvector extension. The pipeline runs as a full
              rebuild — every run deletes existing rows and re-inserts from
              scratch.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card
                title="Scrape"
                body="76 doc pages from dev.clever.com are fetched sequentially with a 500ms delay. Cheerio strips nav, sidebar, and footer elements, then extracts text from headings, paragraphs, list items, code blocks, and table cells."
                accent="bg-clever-blue"
              />
              <Card
                title="Chunk"
                body="Each page is split into ~1,000-character chunks with 200-character overlap, breaking on markdown heading boundaries first, then paragraph boundaries for oversized sections."
                accent="bg-clever-green"
              />
              <Card
                title="Tag"
                body="Every chunk is classified into an integration path — Library, Secure Sync, LMS Connect, Attendance, or general — by matching the source URL against a priority-ordered rule table."
                accent="bg-clever-yellow"
              />
              <Card
                title="Embed &amp; store"
                body="Chunks are embedded in batches of 100 using text-embedding-3-small (1,536 dimensions) via the AI Gateway, then inserted into a Postgres table indexed with HNSW for fast cosine similarity search."
                accent="bg-clever-orange"
              />
            </div>
          </section>

          {/* Key decisions */}
          <section>
            <h2 className="text-2xl text-clever-navy mb-4 font-[family-name:var(--font-heading)]">
              Design decisions
            </h2>
            <dl className="space-y-5">
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
            <h2 className="text-2xl text-clever-navy mb-4 font-[family-name:var(--font-heading)]">
              Production thinking
            </h2>
            <ul className="space-y-3 text-clever-black/70 font-[family-name:var(--font-body)]">
              <ProductionItem
                title="Re-ingestion"
                text="Content-hash chunks, only re-embed what changed. A daily cron polls the sitemap for diffs."
              />
              <ProductionItem
                title="Low-confidence queue"
                text='Every "I couldn&apos;t find it" gets logged — the strongest signal of doc gaps the support team should see.'
              />
              <ProductionItem
                title="Rate limiting"
                text="Public endpoints with LLM calls behind them get expensive fast under abuse."
              />
              <ProductionItem
                title="Eval in CI"
                text="The test suite gates PRs on pass-rate, preventing silent regressions when prompts or models change."
              />
            </ul>
          </section>

          {/* Stack */}
          <section>
            <h2 className="text-2xl text-clever-navy mb-4 font-[family-name:var(--font-heading)]">
              Stack
            </h2>
            <div className="overflow-x-auto rounded-xl border border-clever-light-blue">
              <table className="w-full text-sm text-left font-[family-name:var(--font-body)]">
                <thead className="bg-clever-light-blue/50 text-clever-navy">
                  <tr>
                    <th className="px-5 py-3 font-medium">Layer</th>
                    <th className="px-5 py-3 font-medium">Choice</th>
                  </tr>
                </thead>
                <tbody className="text-clever-black/70 divide-y divide-clever-light-blue">
                  <tr className="bg-white">
                    <td className="px-5 py-3">Framework</td>
                    <td className="px-5 py-3">Next.js App Router</td>
                  </tr>
                  <tr className="bg-clever-light-blue/10">
                    <td className="px-5 py-3">AI</td>
                    <td className="px-5 py-3">
                      Vercel AI SDK v6 + AI Gateway
                    </td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-5 py-3">Default model</td>
                    <td className="px-5 py-3">
                      <code className="text-xs bg-clever-light-blue/60 text-clever-navy px-1.5 py-0.5 rounded">
                        openai/gpt-4o-mini
                      </code>
                    </td>
                  </tr>
                  <tr className="bg-clever-light-blue/10">
                    <td className="px-5 py-3">Embeddings</td>
                    <td className="px-5 py-3">
                      <code className="text-xs bg-clever-light-blue/60 text-clever-navy px-1.5 py-0.5 rounded">
                        openai/text-embedding-3-small
                      </code>
                    </td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-5 py-3">Vector store</td>
                    <td className="px-5 py-3">
                      Supabase Postgres + pgvector (Vercel Marketplace)
                    </td>
                  </tr>
                  <tr className="bg-clever-light-blue/10">
                    <td className="px-5 py-3">Hosting</td>
                    <td className="px-5 py-3">Vercel (Fluid Compute)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Brand identity */}
          <section className="bg-clever-light-blue/30 rounded-2xl p-8 border border-clever-light-blue">
            <h2 className="text-2xl text-clever-navy mb-4 font-[family-name:var(--font-heading)]">
              Brand identity
            </h2>
            <p className="text-clever-black/70 leading-relaxed mb-6 font-[family-name:var(--font-body)]">
              The interface follows the Clever Brand Guidelines (V7, August 2025).
              Typography pairs Merriweather (serif headings, standing in for the
              brand&apos;s ABC Arizona Mix) with Inter (sans-serif body text,
              standing in for Messina Sans). Colors draw from the primary palette —
              Clever Blue, white, and dark navy — with secondary accents for visual
              expression.
            </p>
            <div className="flex flex-wrap gap-3">
              <ColorSwatch color="bg-clever-blue" label="Clever Blue" hex="#1464FF" />
              <ColorSwatch color="bg-clever-navy" label="Navy" hex="#0A1E46" textLight />
              <ColorSwatch color="bg-clever-light-blue" label="Light Blue" hex="#DAEBFF" />
              <ColorSwatch color="bg-clever-yellow" label="Yellow" hex="#FFE478" />
              <ColorSwatch color="bg-clever-orange" label="Orange" hex="#F78239" />
              <ColorSwatch color="bg-clever-green" label="Green" hex="#4ECC97" />
            </div>
          </section>
        </article>
      </main>

      <footer className="border-t border-clever-light-blue px-6 py-4">
        <p className="max-w-3xl mx-auto text-xs text-clever-black/40 text-center font-[family-name:var(--font-body)]">
          Built by Tom Leger as a Vercel Solutions Architect take-home (Track B:
          AI Cloud).
        </p>
      </footer>
    </div>
  );
}

function Card({ title, body, accent }: { title: string; body: string; accent: string }) {
  return (
    <div className="rounded-xl border border-clever-light-blue bg-white p-5 relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-1 h-full ${accent}`} />
      <h3 className="font-medium text-clever-navy mb-2 font-[family-name:var(--font-heading)] text-lg">
        {title}
      </h3>
      <p className="text-sm text-clever-black/60 leading-relaxed font-[family-name:var(--font-body)]">
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
    <div className="pl-4 border-l-2 border-clever-light-blue">
      <dt className="font-medium text-clever-navy font-[family-name:var(--font-body)]">{term}</dt>
      <dd className="mt-1 text-sm text-clever-black/60 leading-relaxed font-[family-name:var(--font-body)]">
        {definition}
      </dd>
    </div>
  );
}

function ProductionItem({ title, text }: { title: string; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="w-1.5 h-1.5 rounded-full bg-clever-blue mt-2 shrink-0" />
      <span>
        <strong className="text-clever-navy">{title}:</strong>{" "}
        {text}
      </span>
    </li>
  );
}

function ColorSwatch({ color, label, hex, textLight }: { color: string; label: string; hex: string; textLight?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-8 h-8 rounded-lg ${color} border border-black/5`} />
      <div>
        <div className={`text-xs font-medium ${textLight ? "text-clever-navy" : "text-clever-black/70"}`}>{label}</div>
        <div className="text-[10px] font-mono text-clever-black/40">{hex}</div>
      </div>
    </div>
  );
}
