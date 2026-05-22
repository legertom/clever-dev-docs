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
  { id: "background", label: "Background: what is RAG?" },
  { id: "how-it-works", label: "How it works" },
  { id: "hybrid", label: "Why hybrid retrieval?" },
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

          {/* RAG background — plain-English primer for non-experts */}
          <section id="background" className="scroll-mt-6">
            <h2 className="text-2xl text-clever-navy mb-4 font-[family-name:var(--font-heading)]">
              Background: what is RAG?
            </h2>
            <p className="text-clever-black/70 leading-relaxed font-[family-name:var(--font-body)] mb-4">
              A docs assistant powered by a language model has two problems.
              First, the model doesn&apos;t know about Clever specifically — it
              was trained on the public internet, not on Clever&apos;s
              documentation. Second, asking a model to answer from its general
              knowledge produces plausible-sounding answers that are sometimes
              subtly (and sometimes wildly) wrong.
            </p>
            <p className="text-clever-black/70 leading-relaxed font-[family-name:var(--font-body)] mb-4">
              <strong className="text-clever-navy">Retrieval-Augmented Generation (RAG)</strong>{" "}
              solves both. Before generating an answer, the system{" "}
              <em>retrieves</em>{" "}the most relevant pieces of documentation and
              feeds them to the model as context. The model&apos;s job becomes
              &ldquo;answer this question using only these facts,&rdquo; not
              &ldquo;remember what you know.&rdquo; Answers are phrased in
              natural language, but the facts come from a known, citable source
              — so we can show the developer exactly where each claim came from.
            </p>
            <p className="text-clever-black/70 leading-relaxed font-[family-name:var(--font-body)]">
              This is the same pattern any organization uses to build an AI
              assistant over its own content: internal wikis, customer support
              knowledge bases, code documentation, legal libraries.
            </p>
            <div className="rounded-xl border border-clever-light-blue bg-clever-light-blue/20 p-5 mt-6">
              <p className="text-sm text-clever-black/70 font-[family-name:var(--font-body)]">
                <strong className="text-clever-navy">New to RAG?</strong>{" "}
                DeepLearning.AI&apos;s{" "}
                <a
                  href="https://www.deeplearning.ai/courses/retrieval-augmented-generation"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-clever-blue hover:text-clever-navy underline transition-colors"
                >
                  Retrieval-Augmented Generation
                </a>{" "}
                course is a good conceptual introduction.
              </p>
            </div>
          </section>

          {/* Architecture — illustrated pipeline */}
          <section id="how-it-works" className="scroll-mt-6">
            <h2 className="text-2xl text-clever-navy mb-3 font-[family-name:var(--font-heading)]">
              How it works
            </h2>
            <p className="text-clever-black/70 leading-relaxed font-[family-name:var(--font-body)] mb-8">
              Here&apos;s the runtime path of a single question — from the
              moment a developer hits send to the cited answer they read back.
            </p>
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
                  icon={<RewriteIcon />}
                  color="bg-clever-yellow"
                  label="Rewrite"
                  description="In a back-and-forth conversation, a follow-up like “what about student email?” only makes sense in context. A quick LLM call rewrites it into a single self-contained question (“what student email fields does Clever Library expose?”) — so every downstream step sees the real question, not just the latest fragment. Skipped entirely for the first question of a conversation."
                  isBranch
                />

                <PipelineNode
                  icon={<ShieldIcon />}
                  color="bg-clever-orange"
                  label="Classify"
                  description="A lightweight LLM call classifies the rewritten query as on-topic, off-topic, harmful, or nonsense. Off-topic and harmful queries get a canned response — the rest of the pipeline never runs. Classifying after the rewrite means a contextual follow-up like “what about student email?” gets judged on its expanded meaning, not the bare fragment."
                  isBranch
                />

                <PipelineNode
                  icon={<EmbedIcon />}
                  color="bg-clever-blue"
                  label="Embed"
                  description="The question is converted into a numerical fingerprint — a list of 1,536 numbers — that captures its meaning. Two questions with similar meanings produce similar fingerprints. (Done by OpenAI's text-embedding-3-small via the AI Gateway.)"
                />

                <PipelineNode
                  icon={<SearchIcon />}
                  color="bg-clever-blue"
                  label="Retrieve"
                  description="The system searches the docs two ways at once — by meaning and by exact keywords — then merges the results. The next section, “Why hybrid retrieval?”, explains why both."
                />

                {/* Branch: confidence gate */}
                <PipelineNode
                  icon={<GateIcon />}
                  color="bg-clever-orange"
                  label="Confidence gate"
                  description="The system runs two independent checks against retrieval quality. (1) If the semantic match is weak, the question is logged to the doc-gap queue — even when keyword search rescued a chunk that let the chat answer anyway. (2) If no rescued chunk is strong enough either, the prompt is switched to a fallback that tells the model to admit it doesn't know rather than guess."
                  isBranch
                />

                <PipelineNode
                  icon={<RouteIcon />}
                  color="bg-clever-yellow"
                  label="Prompt assembly"
                  description="The retrieved chunks and the system instructions are combined into the prompt the model will see. The instructions cover how to cite sources, how to handle questions that span multiple integration paths (see callout below), and — when confidence was low — to admit uncertainty rather than guess."
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

            {/* Two key guarantees that fall out of the pipeline above —
                pulled into callouts so non-experts don't have to extract
                them from the per-step descriptions. */}
            <div className="grid sm:grid-cols-2 gap-4 mt-10">
              <div className="rounded-xl border border-clever-light-blue bg-white p-5">
                <div className="text-xs uppercase tracking-wider text-clever-green mb-2 font-[family-name:var(--font-body)]">
                  Why this avoids hallucinations
                </div>
                <p className="text-sm text-clever-black/60 leading-relaxed font-[family-name:var(--font-body)]">
                  The model sees only the retrieved doc chunks as context
                  — it cannot draw on memorized training-data answers
                  about Clever. If a fact isn&apos;t in the retrieved
                  chunks, the model has no source for it. Combined with
                  the confidence gate, this is what keeps the assistant
                  honest: it answers from the docs or admits it
                  doesn&apos;t know.
                </p>
              </div>
              <div className="rounded-xl border border-clever-light-blue bg-white p-5">
                <div className="text-xs uppercase tracking-wider text-clever-orange mb-2 font-[family-name:var(--font-body)]">
                  Audience-aware answers
                </div>
                <p className="text-sm text-clever-black/60 leading-relaxed font-[family-name:var(--font-body)]">
                  Every doc chunk is tagged at ingest time with which
                  integration path it covers — Library, Secure Sync,
                  LMS Connect. The system prompt instructs the model to
                  surface the right path: an indie developer asking
                  about Secure Sync gets a real answer about what it
                  is, plus a note that the path requires working with a
                  Clever Application Success Manager.
                </p>
              </div>
            </div>
          </section>

          {/* Why hybrid retrieval — deep-dive on the key design choice */}
          <section id="hybrid" className="scroll-mt-6">
            <h2 className="text-2xl text-clever-navy mb-4 font-[family-name:var(--font-heading)]">
              Why hybrid retrieval?
            </h2>
            <p className="text-clever-black/70 leading-relaxed font-[family-name:var(--font-body)] mb-2">
              Retrieval — the step above where the system finds the right
              pieces of the docs to feed the model — is where most of the
              answer quality comes from. There are two distinct ways to do
              it, and they catch different kinds of questions.
            </p>

            {/* Side-by-side: vector vs keyword */}
            <div className="grid sm:grid-cols-2 gap-4 my-6">
              <div className="rounded-xl border border-clever-light-blue bg-white p-5">
                <div className="text-xs uppercase tracking-wider text-clever-blue mb-2 font-[family-name:var(--font-body)]">
                  Vector search
                </div>
                <div className="text-base font-medium text-clever-navy mb-3 font-[family-name:var(--font-heading)]">
                  Matches on meaning
                </div>
                <p className="text-sm text-clever-black/60 leading-relaxed font-[family-name:var(--font-body)]">
                  The question gets turned into a numerical fingerprint, and
                  the system finds doc chunks whose fingerprints are similar.
                  Great for paraphrased questions: ask &ldquo;how do I sign in
                  users?&rdquo; and it finds the page about authentication
                  even if that page never uses the word &ldquo;sign in.&rdquo;
                  This is what most RAG tutorials teach.
                </p>
              </div>
              <div className="rounded-xl border border-clever-light-blue bg-white p-5">
                <div className="text-xs uppercase tracking-wider text-clever-orange mb-2 font-[family-name:var(--font-body)]">
                  Keyword search
                </div>
                <div className="text-base font-medium text-clever-navy mb-3 font-[family-name:var(--font-heading)]">
                  Matches on exact words
                </div>
                <p className="text-sm text-clever-black/60 leading-relaxed font-[family-name:var(--font-body)]">
                  Sounds primitive, but catches a specific failure mode of
                  vector search. When the answer hinges on an exact field
                  name buried in a JSON example — like{" "}
                  <code className="text-xs bg-clever-light-blue/60 text-clever-navy px-1 rounded">section_id</code>{" "}
                  or{" "}
                  <code className="text-xs bg-clever-light-blue/60 text-clever-navy px-1 rounded">created</code>{" "}
                  — vector search often misses it. The page doesn&apos;t{" "}
                  <em>describe</em>{" "}the field in prose; it just shows the
                  field in a code block. Embeddings don&apos;t pick up code well.
                </p>
              </div>
            </div>

            <p className="text-clever-black/70 leading-relaxed font-[family-name:var(--font-body)] mb-4">
              <strong className="text-clever-navy">Hybrid retrieval</strong>{" "}
              runs both at the same time and merges the results, using a
              technique called Reciprocal Rank Fusion. Whichever search finds
              the right page wins — we don&apos;t have to choose in advance.
            </p>

            {/* RRF explainer callout — explains the term used above */}
            <div className="rounded-xl border border-clever-light-blue bg-clever-light-blue/20 p-5 my-6">
              <div className="text-xs uppercase tracking-wider text-clever-navy/60 mb-3 font-[family-name:var(--font-body)]">
                What is Reciprocal Rank Fusion?
              </div>
              <p className="text-sm text-clever-black/70 leading-relaxed font-[family-name:var(--font-body)] mb-3">
                The two searches produce scores on completely different
                scales. Vector similarity is a number between 0 and 1
                (how close two meanings are); keyword relevance is
                unbounded and depends on word frequency. Averaging the
                two directly would be like averaging Celsius and
                Fahrenheit — the result is meaningless.
              </p>
              <p className="text-sm text-clever-black/70 leading-relaxed font-[family-name:var(--font-body)] mb-3">
                RRF sidesteps the problem by ignoring the raw scores
                and looking only at the{" "}
                <em>rankings</em>{" "}each method produced. For every
                chunk that either search returned, it computes{" "}
                <code className="text-xs bg-white/70 text-clever-navy px-1 rounded">1 / (60 + rank)</code>{" "}
                in each list and sums those values. A chunk that ranks
                #1 in keyword search and #3 in vector search gets a
                high combined score; a chunk that ranks well in only
                one list scores lower. Chunks that both methods
                strongly agree on bubble to the top.
              </p>
              <p className="text-sm text-clever-black/70 leading-relaxed font-[family-name:var(--font-body)]">
                The 60 is a smoothing constant from the original RRF
                paper (Cormack et al., 2009) — it dampens the
                dominance of any single #1 result, so a chunk that
                ranks #2 in both lists can outrank one that ranks #1
                in only one. That&apos;s the whole algorithm —
                three lines of SQL. The reason it&apos;s the standard
                fusion method for hybrid search is precisely that it
                doesn&apos;t need to know anything about the scoring
                systems it&apos;s combining.
              </p>
            </div>

            {/* Concrete example callout */}
            <div className="rounded-xl border border-clever-light-blue bg-clever-light-blue/20 p-5 my-6">
              <div className="text-xs uppercase tracking-wider text-clever-navy/60 mb-3 font-[family-name:var(--font-body)]">
                Concrete example
              </div>
              <p className="text-sm text-clever-black/70 font-[family-name:var(--font-body)] mb-3">
                A developer asks:{" "}
                <strong className="text-clever-navy">
                  &ldquo;is the created date shared by default?&rdquo;
                </strong>
              </p>
              <ul className="space-y-2 text-sm text-clever-black/60 font-[family-name:var(--font-body)]">
                <li>
                  <strong className="text-clever-navy">Vector alone:</strong>{" "}
                  returns nothing it&apos;s confident in. The assistant tells
                  the developer it can&apos;t find the answer.
                </li>
                <li>
                  <strong className="text-clever-navy">Keyword alone:</strong>{" "}
                  finds the contacts page immediately because{" "}
                  <code className="text-xs bg-white/70 text-clever-navy px-1 rounded">created</code>{" "}
                  appears as a literal field name in a JSON example on that
                  page.
                </li>
                <li>
                  <strong className="text-clever-navy">Hybrid:</strong>{" "}the
                  keyword half rescues the right page, and the developer
                  gets the answer with a citation.
                </li>
              </ul>
            </div>

            <h3 className="text-lg text-clever-navy mt-8 mb-3 font-[family-name:var(--font-heading)]">
              The tradeoff
            </h3>
            <p className="text-clever-black/70 leading-relaxed font-[family-name:var(--font-body)] mb-4">
              Keyword search adds a parallel database query, and the merged
              result set is slightly larger, so the model sees a few hundred
              extra tokens of context per question. Hybrid costs a fraction
              of a cent more per query and adds roughly 50–100ms of latency.
            </p>
            <p className="text-clever-black/70 leading-relaxed font-[family-name:var(--font-body)] mb-4">
              What you get for that cost: across our eval set, hybrid
              retrieval{" "}
              <strong className="text-clever-navy">
                hallucinates less often
              </strong>{" "}
              than vector alone — the failure mode that matters most for a
              docs assistant, since a confidently wrong answer about
              certification could send a developer down a multi-week dead
              end. Correctness rates are comparable and vary between runs;
              on already-strong models, vector can occasionally edge ahead
              on speed or cost.
            </p>
            <p className="text-clever-black/70 leading-relaxed font-[family-name:var(--font-body)]">
              Hybrid is the default because lower hallucination is the right
              tradeoff for a docs assistant. It&apos;s a deliberate choice,
              not a clean win — and you can verify it yourself: the toggle
              on the{" "}
              <a
                href="/"
                className="text-clever-blue hover:text-clever-navy underline transition-colors"
              >
                chat
              </a>{" "}
              and{" "}
              <a
                href="/eval"
                className="text-clever-blue hover:text-clever-navy underline transition-colors"
              >
                eval
              </a>{" "}
              pages runs either mode, or both side by side, and shows the
              live numbers.
            </p>
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
                term="Front-loaded cost filters, downstream quality gate"
                definition="Rate limit (Upstash, ~free) bounces abusive IPs entirely. A gpt-4o-mini classifier (~$0.00002) catches off-topic and harmful queries with a canned response — saving the cost of embedding, retrieval, and generation that would otherwise follow. For on-topic queries the full pipeline runs (~$0.0003–$0.008 per query depending on output length); the confidence gate doesn't skip generation, it switches the prompt to a fallback when retrieval was weak so the model admits uncertainty instead of guessing. The pattern: cheap filters absorb bad traffic upfront; the gate downstream guards against the more expensive failure mode — a confidently wrong answer."
              />
              <DecisionItem
                term="AI Gateway over provider SDKs"
                definition="One auth mechanism, one observability surface, zero code changes to swap providers. The eval page compares OpenAI and Anthropic models with a string change."
              />
              <DecisionItem
                term="pgvector over a dedicated vector DB"
                definition="For a corpus this size (~770 chunks), Postgres with HNSW is sub-100ms — no dedicated vector database to run, monitor, or keep in sync. Full-text search lives in the same Postgres (a generated tsvector + GIN index), so the lexical half of retrieval adds zero extra infrastructure either. This decision is purely operational: what to run."
              />
              <DecisionItem
                term="Multi-turn query rewriting before classify and retrieve"
                definition="A bare follow-up like “what about student email?” makes sense reading the conversation but means nothing to a retrieval system — and looks off-topic to the pre-flight classifier. A cheap LLM call condenses the whole conversation into a single self-contained question before downstream steps run, so the classifier judges the expanded form and retrieval embeds and searches on it. Single-turn conversations skip the rewrite entirely (no history to condense), so the first message of a chat costs nothing extra and existing eval scores don't move. Errors fall back to the raw last message, so a rewrite failure never breaks the chat."
              />
              <DecisionItem
                term="Live eval as a demo surface"
                definition="This is for demonstration, not production monitoring. The eval page exists so anyone evaluating this project can run the test set on demand and watch it work — model-vs-model comparison, real USD cost per query, full rubric scores — instead of taking a CLI pass-rate on faith."
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
                title="Re-ingestion (planned)"
                text="Today every ingest is a full rebuild. The production path: content-hash each chunk, re-embed only what changed, and a daily cron that polls the sitemap for diffs."
              />
              <ProductionItem
                title="Low-confidence queue"
                text="Every query where the underlying semantic match was weak gets logged — even when keyword rescue let the chat answer the user anyway. Catches doc gaps the user never sees, so the support team can fix them before they cause real frustration."
              />
              <ProductionItem
                title="Rate limiting"
                text="Upstash Redis enforces a 20-request-per-minute sliding window per IP. Blocked requests return 429 before touching the AI Gateway."
              />
              <ProductionItem
                title="Eval in CI (planned)"
                text="A pnpm eval CLI already scores the test set on demand. The next step: run it in CI to gate PRs on pass-rate, preventing silent regressions when prompts or models change."
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

function RewriteIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 4l6 6-10 10H4v-6L14 4z" stroke="white" strokeWidth="2" strokeLinejoin="round" opacity="0.9" />
      <path d="M14 4l6 6" stroke="white" strokeWidth="2" opacity="0.5" />
      <path d="M4 20l4-4" stroke="white" strokeWidth="1.5" opacity="0.5" />
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
