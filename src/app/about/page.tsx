import type { Metadata } from "next";
import TableOfContents, { type TocItem } from "@/components/TableOfContents";

export const metadata: Metadata = {
  title: "About — Clever Dev Docs Assistant",
  description:
    "How this RAG-powered assistant works: architecture, design decisions, and production thinking.",
};

const tocItems: TocItem[] = [
  { id: "what-this-is", label: "What this is" },
  { id: "audience", label: "Who it's for" },
  { id: "how-it-works", label: "How it works" },
  { id: "guardrails", label: "Guardrails" },
  { id: "ingestion", label: "Knowledge base" },
  { id: "design-decisions", label: "Design decisions" },
  { id: "production", label: "Production thinking" },
  { id: "stack", label: "Stack" },
  { id: "ai-sdk", label: "AI SDK toolkit" },
  { id: "brand", label: "Brand identity" },
];

export default function AboutPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-white scroll-smooth">
      {/* Hero header with navy background */}
      <header className="bg-clever-navy px-6 pt-10 pb-16 relative overflow-hidden">
        {/* Decorative brand shapes */}
        <div className="absolute top-8 right-12 w-48 h-48 bg-clever-blue/20 clever-blob-1" aria-hidden="true" />
        <div className="absolute -bottom-8 right-1/3 w-32 h-32 bg-clever-green/15 clever-blob-2" aria-hidden="true" />
        <div className="absolute top-20 left-8 w-20 h-20 bg-clever-yellow/10 clever-blob-3" aria-hidden="true" />

        <div className="max-w-3xl mx-auto relative">
          <h1 className="text-4xl sm:text-5xl text-white font-normal font-[family-name:var(--font-heading)] leading-[0.95] mb-4">
            About this assistant
          </h1>
          <p className="text-lg text-white/60 max-w-lg font-[family-name:var(--font-body)] leading-relaxed">
            Architecture, design decisions, and the production thinking behind a RAG-powered docs assistant.
          </p>
        </div>
      </header>

      <main className="flex-1 px-6 -mt-10">
        <div className="max-w-3xl lg:max-w-[1120px] mx-auto lg:grid lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-12">
          <article className="space-y-12 pb-16 min-w-0">
          {/* Intro card overlapping the hero */}
          <section id="what-this-is" className="bg-white rounded-2xl border border-clever-light-blue p-8 shadow-md relative z-10 scroll-mt-6">
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
          <section id="audience" className="scroll-mt-6">
            <h2 className="text-2xl text-clever-navy mb-4 font-[family-name:var(--font-heading)]">
              Who it&apos;s for
            </h2>
            <p className="text-clever-black/70 leading-relaxed font-[family-name:var(--font-body)]">
              Any developer building on the Clever platform — whether
              you&apos;re an independent builder shipping a classroom app, a
              partner engineering team integrating Secure Sync, or an internal
              developer working on the platform itself. The existing support
              widget routes through a decision tree; this gives everyone answers
              directly from the docs, instantly.
            </p>
          </section>

          {/* Architecture — illustrated pipeline */}
          <section id="how-it-works" className="scroll-mt-6">
            <h2 className="text-2xl text-clever-navy mb-8 font-[family-name:var(--font-heading)]">
              How it works
            </h2>
            <div className="relative">
              {/* Vertical connector line */}
              <div className="absolute left-6 sm:left-8 top-10 bottom-10 w-px bg-gradient-to-b from-clever-blue via-clever-green to-clever-orange" aria-hidden="true" />

              <div className="space-y-0">
                {/* Start node */}
                <PipelineNode
                  icon={<QuestionIcon />}
                  color="bg-clever-blue"
                  label="Your question"
                  description="A developer asks a natural-language question about the Clever platform."
                  isFirst
                />

                <PipelineNode
                  icon={<RateLimitIcon />}
                  color="bg-clever-orange"
                  label="Rate limit"
                  description="Upstash Redis enforces a sliding window of 20 requests per minute per IP. Abusers get a 429 before any AI cost is incurred."
                  isBranch
                />

                <PipelineNode
                  icon={<ShieldIcon />}
                  color="bg-clever-orange"
                  label="Classify"
                  description="A lightweight LLM call classifies the query as on-topic, off-topic, harmful, or nonsense. Off-topic and harmful queries get a canned response — the RAG pipeline never runs."
                  isBranch
                />

                <PipelineNode
                  icon={<EmbedIcon />}
                  color="bg-clever-blue"
                  label="Embed"
                  description="The question is converted into a 1,536-dimension vector using text-embedding-3-small via the AI Gateway."
                />

                <PipelineNode
                  icon={<SearchIcon />}
                  color="bg-clever-blue"
                  label="Retrieve"
                  description="Hybrid retrieval: pgvector cosine similarity (semantic match) and Postgres full-text search (exact-keyword match) run in parallel, then fuse with Reciprocal Rank Fusion. Vector catches paraphrased questions; FTS catches keywords buried in code or JSON examples that embeddings tend to underweight."
                />

                {/* Branch: confidence gate */}
                <PipelineNode
                  icon={<GateIcon />}
                  color="bg-clever-orange"
                  label="Confidence gate"
                  description="Below 0.6 similarity, the system prompt switches modes — the model admits uncertainty instead of improvising."
                  isBranch
                />

                <PipelineNode
                  icon={<RouteIcon />}
                  color="bg-clever-yellow"
                  label="Audience routing"
                  description="Chunks are tagged by integration path (Library, Secure Sync, LMS Connect). When answers differ by path, the model presents both variants."
                  isBranch
                />

                <PipelineNode
                  icon={<GenerateIcon />}
                  color="bg-clever-green"
                  label="Generate"
                  description="The AI SDK streams a completion through the Vercel AI Gateway. The model sees only retrieved docs — no memorized knowledge."
                />

                {/* End node */}
                <PipelineNode
                  icon={<AnswerIcon />}
                  color="bg-clever-green"
                  label="Cited answer"
                  description="The developer gets a grounded answer with source links back to dev.clever.com."
                  isLast
                />
              </div>
            </div>
          </section>

          {/* Guardrails */}
          <section id="guardrails" className="scroll-mt-6">
            <h2 className="text-2xl text-clever-navy mb-4 font-[family-name:var(--font-heading)]">
              Guardrails
            </h2>
            <p className="text-clever-black/70 leading-relaxed mb-6 font-[family-name:var(--font-body)]">
              Before a query enters the retrieval pipeline, a lightweight
              classification step decides whether it belongs there at all.
              This saves compute on junk queries and gives users an appropriate
              response instead of a misleading &ldquo;I couldn&apos;t find
              that in the docs.&rdquo;
            </p>
            <div className="overflow-x-auto rounded-xl border border-clever-light-blue">
              <table className="w-full text-sm text-left font-[family-name:var(--font-body)]">
                <thead className="bg-clever-light-blue/50 text-clever-navy">
                  <tr>
                    <th className="px-5 py-3 font-medium">Category</th>
                    <th className="px-5 py-3 font-medium">Example</th>
                    <th className="px-5 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="text-clever-black/70 divide-y divide-clever-light-blue">
                  <tr className="bg-white">
                    <td className="px-5 py-3 font-medium text-clever-navy">On-topic</td>
                    <td className="px-5 py-3">&ldquo;How do I get student data from the API?&rdquo;</td>
                    <td className="px-5 py-3">Full RAG pipeline</td>
                  </tr>
                  <tr className="bg-clever-light-blue/10">
                    <td className="px-5 py-3 font-medium text-clever-navy">Off-topic</td>
                    <td className="px-5 py-3">&ldquo;Reverse a linked list in Python&rdquo;</td>
                    <td className="px-5 py-3">Canned deflection, skip RAG</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-5 py-3 font-medium text-clever-navy">Harmful</td>
                    <td className="px-5 py-3">Threats, harassment, dangerous requests</td>
                    <td className="px-5 py-3">Safety response, skip RAG, logged</td>
                  </tr>
                  <tr className="bg-clever-light-blue/10">
                    <td className="px-5 py-3 font-medium text-clever-navy">Nonsense</td>
                    <td className="px-5 py-3">&ldquo;asdfghjkl&rdquo;, insults, trolling</td>
                    <td className="px-5 py-3">Short deflection, skip RAG</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-clever-black/50 font-[family-name:var(--font-body)]">
              The classifier runs as a single <code className="text-xs bg-clever-light-blue/60 text-clever-navy px-1.5 py-0.5 rounded">generateText</code> call
              with gpt-4o-mini — fast and cheap enough to gate every query.
              Non-on-topic queries are logged so the team can monitor abuse
              patterns without the data landing in the feedback queue as false
              &ldquo;doc gaps.&rdquo;
            </p>
          </section>

          {/* Ingestion pipeline — illustrated */}
          <section id="ingestion" className="scroll-mt-6">
            <h2 className="text-2xl text-clever-navy mb-3 font-[family-name:var(--font-heading)]">
              Building the knowledge base
            </h2>
            <p className="text-clever-black/70 leading-relaxed mb-8 font-[family-name:var(--font-body)]">
              The vector database is populated by a CLI script (<code className="text-xs bg-clever-light-blue/60 text-clever-navy px-1.5 py-0.5 rounded">pnpm ingest</code>) that
              scrapes, chunks, and embeds the Clever developer docs into Supabase
              Postgres with the pgvector extension. The pipeline runs as a full
              rebuild — every run deletes existing rows and re-inserts from
              scratch.
            </p>
            <div className="relative">
              <div className="absolute left-6 sm:left-8 top-10 bottom-10 w-px bg-gradient-to-b from-clever-blue via-clever-yellow to-clever-orange" aria-hidden="true" />

              <div className="space-y-0">
                <PipelineNode
                  icon={<ScrapeIcon />}
                  color="bg-clever-blue"
                  label="Scrape"
                  description="Every public doc page listed in dev.clever.com&apos;s sitemap is fetched sequentially with a 500ms delay. Cheerio strips nav, sidebar, and footer elements, extracting text from headings, paragraphs, list items, code blocks, and table cells."
                  isFirst
                />
                <PipelineNode
                  icon={<ChunkIcon />}
                  color="bg-clever-green"
                  label="Chunk"
                  description="Each page is split into ~1,000-character chunks with 200-character overlap, breaking on markdown heading boundaries first, then paragraph boundaries for oversized sections."
                />
                <PipelineNode
                  icon={<RouteIcon />}
                  color="bg-clever-yellow"
                  label="Tag"
                  description="Every chunk is classified into an integration path — Library, Secure Sync, LMS Connect, Attendance, or general — by matching the source URL against a priority-ordered rule table."
                />
                <PipelineNode
                  icon={<StoreIcon />}
                  color="bg-clever-orange"
                  label="Embed &amp; store"
                  description="Chunks are embedded in batches of 100 using text-embedding-3-small (1,536 dimensions) via the AI Gateway, then inserted into a Postgres table indexed with HNSW for vector similarity and a generated tsvector + GIN index for full-text search. Title text is weighted above body so keyword matches on a page&apos;s title outrank passing mentions."
                  isLast
                />
              </div>
            </div>
          </section>

          {/* Key decisions */}
          <section id="design-decisions" className="scroll-mt-6">
            <h2 className="text-2xl text-clever-navy mb-4 font-[family-name:var(--font-heading)]">
              Design decisions
            </h2>
            <dl className="space-y-5">
              <DecisionItem
                term="gpt-4o-mini over a flagship model"
                definition="At ~$0.0003 per query, the cheap model handles factual lookups where retrieval does the heavy lifting. The eval shows exactly which questions need a smarter model."
              />
              <DecisionItem
                term="Layered defense, ascending cost"
                definition="Every chat query passes through three filters in cheap-to-expensive order: a gpt-4o-mini classifier (~$0.00002) catches off-topic and harmful queries before retrieval runs; a confidence gate (~$0.0005) catches in-domain questions the docs can't answer and politely declines; full RAG generation (~$0.0003–$0.008) only runs when both checks pass. Front-loading the cheap layer means bad traffic gets bounced before flagship costs are paid — same pattern as a CDN with edge caches in front of origin."
              />
              <DecisionItem
                term="AI Gateway over provider SDKs"
                definition="One auth mechanism, one observability surface, zero code changes to swap providers. The eval page compares OpenAI and Anthropic models with a string change."
              />
              <DecisionItem
                term="pgvector over a dedicated vector DB"
                definition="For ~200 chunks, Postgres with HNSW is sub-100ms, operationally simpler, and one less service to monitor. Same Postgres also powers the lexical half of hybrid retrieval (tsvector + GIN), so vector and full-text search share one query path — no second service to run or sync."
              />
              <DecisionItem
                term="Live eval as a product page"
                definition="Not just a CI script. Putting the eval in the app means you can see what the system is actually doing — cost per query, cross-provider comparison, rubric scores — right now."
              />
            </dl>
          </section>

          {/* Production thinking */}
          <section id="production" className="scroll-mt-6">
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
                text="Upstash Redis enforces a 20-request-per-minute sliding window per IP. Blocked requests return 429 before touching the AI Gateway."
              />
              <ProductionItem
                title="Eval in CI"
                text="The test suite gates PRs on pass-rate, preventing silent regressions when prompts or models change."
              />
            </ul>
          </section>

          {/* Stack */}
          <section id="stack" className="scroll-mt-6">
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

          {/* AI SDK toolkit */}
          <section id="ai-sdk" className="scroll-mt-6">
            <h2 className="text-2xl text-clever-navy mb-4 font-[family-name:var(--font-heading)]">
              AI SDK toolkit
            </h2>
            <p className="text-clever-black/70 leading-relaxed mb-6 font-[family-name:var(--font-body)]">
              The primitives from{" "}
              <code className="text-xs bg-clever-light-blue/60 text-clever-navy px-1.5 py-0.5 rounded">ai</code>,{" "}
              <code className="text-xs bg-clever-light-blue/60 text-clever-navy px-1.5 py-0.5 rounded">@ai-sdk/react</code>, and{" "}
              <code className="text-xs bg-clever-light-blue/60 text-clever-navy px-1.5 py-0.5 rounded">@ai-sdk/gateway</code>{" "}
              that this app actually leans on.
            </p>
            <dl className="space-y-5">
              <SdkItem
                term={
                  <>
                    <code className="text-xs bg-clever-light-blue/60 text-clever-navy px-1.5 py-0.5 rounded">useChat</code>
                    {" + "}
                    <code className="text-xs bg-clever-light-blue/60 text-clever-navy px-1.5 py-0.5 rounded">DefaultChatTransport</code>
                  </>
                }
                definition="Streaming chat state on the client, plus the transport that pipes messages to /api/chat."
              />
              <SdkItem
                term={
                  <>
                    <code className="text-xs bg-clever-light-blue/60 text-clever-navy px-1.5 py-0.5 rounded">streamText</code>
                    {" → "}
                    <code className="text-xs bg-clever-light-blue/60 text-clever-navy px-1.5 py-0.5 rounded">.toUIMessageStreamResponse()</code>
                  </>
                }
                definition="The streaming backbone of the chat route handler. Returns a stream useChat reads token-by-token."
              />
              <SdkItem
                term={
                  <code className="text-xs bg-clever-light-blue/60 text-clever-navy px-1.5 py-0.5 rounded">
                    convertToModelMessages
                  </code>
                }
                definition="Converts UI message format to provider-native format on every multi-turn call — the same chat history works across providers."
              />
              <SdkItem
                term={
                  <code className="text-xs bg-clever-light-blue/60 text-clever-navy px-1.5 py-0.5 rounded">
                    createUIMessageStream
                  </code>
                }
                definition="Synthesizes a stream in the guardrail canned-response path, so deflections render uniformly in the chat UI even when no model call happens."
              />
              <SdkItem
                term={
                  <>
                    <code className="text-xs bg-clever-light-blue/60 text-clever-navy px-1.5 py-0.5 rounded">embed</code>
                    {" / "}
                    <code className="text-xs bg-clever-light-blue/60 text-clever-navy px-1.5 py-0.5 rounded">embedMany</code>
                  </>
                }
                definition="Single-query embedding for retrieval, batched embedding for ingestion. Both share the same gateway.textEmbeddingModel() reference so query and corpus embeddings can't drift."
              />
              <SdkItem
                term={
                  <>
                    <code className="text-xs bg-clever-light-blue/60 text-clever-navy px-1.5 py-0.5 rounded">usage</code>
                    {" token counts"}
                  </>
                }
                definition="Captured after each generateText call to compute live USD cost on the eval page — the foundation of the cost-transparency story."
              />
              <SdkItem
                term={
                  <>
                    {"Gateway model strings ("}
                    <code className="text-xs bg-clever-light-blue/60 text-clever-navy px-1.5 py-0.5 rounded">provider/model</code>
                    {")"}
                  </>
                }
                definition="The Gateway routes by string. Swapping OpenAI for Anthropic on the eval page is a one-line allowlist change — no SDK install, no auth swap."
              />
            </dl>
          </section>

          {/* Brand identity */}
          <section id="brand" className="bg-clever-light-blue/30 rounded-2xl p-8 border border-clever-light-blue scroll-mt-6">
            <h2 className="text-2xl text-clever-navy mb-4 font-[family-name:var(--font-heading)]">
              Brand identity
            </h2>
            <p className="text-clever-black/70 leading-relaxed mb-6 font-[family-name:var(--font-body)]">
              The interface follows the Clever General Template
              (V4, July 2025). Headlines are set in Merriweather, body
              copy in Inter — the two typefaces specified in the
              brand. Backgrounds stay white or light blue (the brand&apos;s
              guidance for internal-facing surfaces), with navy reserved
              for hero treatments. The full palette is below.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl bg-white border border-clever-light-blue p-4">
                <div className="text-[10px] uppercase tracking-wider text-clever-black/40 mb-2 font-[family-name:var(--font-body)]">
                  Headlines
                </div>
                <div className="text-2xl text-clever-navy font-[family-name:var(--font-heading)] leading-tight">
                  Merriweather
                </div>
                <div className="text-xs text-clever-black/50 mt-1 font-[family-name:var(--font-body)]">
                  Serif. Used for every heading on every page.
                </div>
              </div>
              <div className="rounded-xl bg-white border border-clever-light-blue p-4">
                <div className="text-[10px] uppercase tracking-wider text-clever-black/40 mb-2 font-[family-name:var(--font-body)]">
                  Body
                </div>
                <div className="text-2xl text-clever-navy font-[family-name:var(--font-body)] leading-tight">
                  Inter
                </div>
                <div className="text-xs text-clever-black/50 mt-1 font-[family-name:var(--font-body)]">
                  Sans-serif. Body copy, UI labels, captions.
                </div>
              </div>
            </div>
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

          <aside className="hidden lg:block pt-12">
            <TableOfContents items={tocItems} />
          </aside>
        </div>
      </main>

      <footer className="border-t border-clever-light-blue px-6 py-4">
        <p className="max-w-3xl mx-auto text-xs text-clever-black/40 text-center font-[family-name:var(--font-body)]">
          Clever Dev Docs Assistant
        </p>
      </footer>
    </div>
  );
}

function PipelineNode({
  icon,
  color,
  label,
  description,
  isFirst,
  isLast,
  isBranch,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  description: string;
  isFirst?: boolean;
  isLast?: boolean;
  isBranch?: boolean;
}) {
  return (
    <div className={`relative flex items-start gap-4 sm:gap-5 ${isFirst ? "" : "pt-6"} ${isLast ? "" : "pb-2"}`}>
      {/* Node circle */}
      <div className="relative z-10 shrink-0">
        <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-2xl ${color} flex items-center justify-center shadow-sm ${isBranch ? "rotate-45" : ""}`}>
          <div className={isBranch ? "-rotate-45" : ""}>{icon}</div>
        </div>
      </div>
      {/* Content */}
      <div className="pt-1 sm:pt-2 min-w-0">
        <h3 className="font-medium text-clever-navy font-[family-name:var(--font-heading)] text-lg leading-tight">
          {label}
        </h3>
        <p className="mt-1 text-sm text-clever-black/60 leading-relaxed font-[family-name:var(--font-body)]">
          {description}
        </p>
      </div>
    </div>
  );
}

function QuestionIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="white" opacity="0.9" />
      <path d="M11 15h2v2h-2v-2zm0-8h2v6h-2V7z" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

function RateLimitIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2" opacity="0.9" />
      <path d="M12 7v5l3 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="white" opacity="0.9" />
      <path d="M10 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
    </svg>
  );
}

function EmbedIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="12" r="2.5" fill="white" opacity="0.9" />
      <circle cx="12" cy="6" r="2.5" fill="white" opacity="0.7" />
      <circle cx="18" cy="12" r="2.5" fill="white" opacity="0.9" />
      <circle cx="12" cy="18" r="2.5" fill="white" opacity="0.7" />
      <path d="M8 11l2.5-3.5M14 8.5L16 11M8 13l2.5 3.5M14 15.5L16 13" stroke="white" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="white" strokeWidth="2.5" opacity="0.9" />
      <path d="M15.5 15.5L20 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

function GateIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" fill="white" opacity="0.9" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4v6" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
      <path d="M12 10L6 18" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <path d="M12 10l6 8" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <path d="M12 10v8" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
      <circle cx="6" cy="18" r="2" fill="white" opacity="0.9" />
      <circle cx="12" cy="18" r="2" fill="white" opacity="0.9" />
      <circle cx="18" cy="18" r="2" fill="white" opacity="0.9" />
    </svg>
  );
}

function GenerateIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="white" opacity="0.2" />
      <path d="M8 12h2l1-3 2 6 1-3h2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    </svg>
  );
}

function AnswerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2" opacity="0.5" />
    </svg>
  );
}

function ScrapeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="white" opacity="0.2" />
      <path d="M11 7h6M11 11h6M11 15h4M7 7h1M7 11h1M7 15h1" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

function ChunkIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" fill="white" opacity="0.9" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" fill="white" opacity="0.7" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" fill="white" opacity="0.7" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" fill="white" opacity="0.5" />
    </svg>
  );
}

function StoreIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="12" cy="7" rx="8" ry="3" fill="white" opacity="0.7" />
      <path d="M4 7v5c0 1.66 3.58 3 8 3s8-1.34 8-3V7" stroke="white" strokeWidth="1.5" opacity="0.9" />
      <path d="M4 12v5c0 1.66 3.58 3 8 3s8-1.34 8-3v-5" stroke="white" strokeWidth="1.5" opacity="0.9" />
    </svg>
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

function SdkItem({
  term,
  definition,
}: {
  term: React.ReactNode;
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
