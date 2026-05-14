# Clever Dev Docs RAG Assistant

A RAG-powered chat assistant for Clever's developer documentation, built on Vercel with the AI SDK, AI Gateway, and Supabase pgvector.

**Live demo:** https://clever-dev-docs.vercel.app
**Eval dashboard:** https://clever-dev-docs.vercel.app/eval

---

## The problem

Developers building on Clever — whether they're independent builders shipping a classroom app via Clever Library, partner engineering teams integrating Secure Sync at the district level, or internal Clever engineers — frequently get stuck on questions already answered in the public docs at [dev.clever.com](https://dev.clever.com). The existing support widget routes through a decision tree to human agents; the existing search returns articles, not answers.

This assistant lets developers ask natural-language questions across the full Clever developer platform — Library, District SSO, Secure Sync, LMS Connect, Attendance Data, the Clever API, and the data model — and get cited answers grounded in the official docs.

## What it does

- **Streaming chat** over Clever's developer docs with multi-turn context
- **Source citations** — every answer references the doc page it came from
- **Fallback behavior** — when retrieval has low confidence, the assistant tells the developer it doesn't know rather than hallucinating
- **Live eval dashboard** at `/eval` — run the test set against three models side-by-side

## Architecture

```
Developer query
      │
      ▼
┌──────────────┐    ┌────────────────────┐
│ Next.js App  │───▶│  /api/chat (route) │
│ (useChat UI) │◀───│  streamText        │
└──────────────┘    └─────────┬──────────┘
                              │
                  1. rate-limit (Upstash) + classify query
                     (off-topic / harmful queries skip pipeline)
                              │
                              ▼
                  2. embed query (text-embedding-3-small)
                              │
                              ▼
                  3. cosine search via Supabase pgvector
                              │
                              ▼
                  4. confidence gate → fallback if top sim < 0.6
                              │
                              ▼
                  5. build system prompt with retrieved chunks
                              │
                              ▼
                  6. stream completion via Vercel AI Gateway
                     ↓
              [openai/gpt-4o-mini] (default)
              [openai/gpt-5.4]      (eval comparison)
              [anthropic/claude-haiku-4.5] (eval comparison)
```

### Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | Server Components for the shell, Route Handlers for streaming. |
| AI SDK | Vercel AI SDK v6 | Provider-agnostic, streaming-first. |
| Model routing | **Vercel AI Gateway** | One env var (or OIDC on Vercel) for all providers. Cross-provider eval needs zero code changes. |
| Default LLM | `openai/gpt-4o-mini` | Cheap and fast. For RAG, retrieval quality matters more than model size. |
| Embeddings | `openai/text-embedding-3-small` | $0.02/1M tokens. Best cost/quality for this corpus size (~770 chunks). |
| Vector store | **Supabase Postgres + pgvector** | Provisioned via Vercel Marketplace. Production-grade, generous free tier, HNSW index for fast ANN search. |
| Hosting | Vercel | Fluid Compute functions, OIDC auth for AI Gateway. |

### Key architectural decisions

**1. Comprehensive corpus, audience-aware system prompt.** All public pages from `dev.clever.com/sitemap.xml` are ingested (Library, District SSO, Secure Sync, LMS Connect, Attendance, full API + data model). Earlier I considered scoping to just the indie-developer subset, but two things changed my mind: semantic search doesn't punish unrelated chunks (they just score low and get filtered), and a more useful product covers the *informational* questions across the whole platform. Where it matters — Secure Sync, LMS Connect, district-managed paths — the system prompt instructs the model to **answer the question AND surface that the path requires a Clever Application Success Manager**. The boundary is enforced in prompt logic, not by exclusion. This means an indie developer asking about Secure Sync gets an honest "here's what it is, but you'd need to coordinate with Clever to get access" instead of a refusal.

**2. AI Gateway over direct provider SDKs.** Going through `@ai-sdk/gateway` (rather than `@ai-sdk/openai`) means: one API key handles all providers, OIDC auth on deployed Vercel functions (no key in env vars), and the `/eval` page can compare OpenAI vs Anthropic with a single string change.

**3. Confidence-based fallback.** When the top retrieval similarity is below 0.6, the system prompt switches to a fallback that explicitly tells the model to admit it doesn't know and direct the developer to support. Hallucinating certification requirements could waste a developer weeks on a bad submission.

**4. Live eval, not just CI eval.** A `/eval` page deployed alongside the product means anyone evaluating the system — a customer team tuning prompts, a new engineer joining the project, an internal stakeholder checking quality — can see what it's actually doing right now: side-by-side model comparison, real USD cost per query, full rubric scores. A CLI eval that ran "trust me, last week" can't offer that. This is how a customer team would think about continuous evaluation.

**4b. Feedback signal as a first-class feature.** A `/feedback` admin page surfaces two doc-gap signals in one queue:

1. **Low-confidence retrievals** — every chat query whose top similarity falls below `CONFIDENCE_THRESHOLD` (0.6) is logged automatically by the chat route, with the query text, retrieved URLs, and the actual top similarity. These are the questions developers are asking that we can't answer well today — the strongest signal of where the docs need work.
2. **User reports** — every assistant message has a "🚩 Flag for review" button. One tap opens an inline form with an optional note; submission posts to `/api/feedback`. These are the strongest signal that a specific answer was unhelpful even when retrieval *did* work.

Both write to the same `feedback` table and render in the same admin view (filter chips for All / Low-confidence / User reports). In production this page would sit behind admin auth; for now it's open since the data is doc-gap signal rather than user PII.

**5. Cost transparency, not "trust me it's cheap."** The eval page surfaces real USD cost per query and aggregate cost per model, computed from token counts returned by the AI Gateway against published per-token prices. This makes the cost/quality trade-off concrete: on a sample reasoning question, `gpt-4o-mini` costs ~$0.00028 and answered incorrectly, while `gpt-5.4` costs ~$0.00817 (29x more) and answered correctly. That's the kind of finding that should drive a routing strategy — escalate hard questions, default to cheap on easy ones — rather than paying flagship prices on every query as insurance.

## Security: secret-handling posture

Two distinct credentials live in this project, and they're handled differently on purpose.

**`AI_GATEWAY_API_KEY` — handled via OIDC, never stored as an env var on Vercel.**
The Vercel AI Gateway authenticates deployed functions using OIDC tokens issued automatically by the Vercel runtime. There's no API key in the project's env vars at all. For local development, a personal AI Gateway key lives in `.env.local` (gitignored). This is the platform-native pattern.

**`SUPABASE_SERVICE_ROLE_KEY` — encrypted in Vercel, marked Sensitive, scoped to Production + Preview only.**
The service-role key bypasses Postgres Row-Level Security and is the highest-privilege credential in the system. To minimize blast radius:

- The Supabase Marketplace integration injects it directly into the Vercel runtime, marked **Sensitive** — encrypted at rest, never readable from the dashboard after provisioning, never returned by the API.
- It is **not** scoped to the Development environment, which means `vercel env pull` will not drop it into any developer's local machine.
- Local ingestion (`pnpm ingest`) requires it once. The dev machine running ingestion fetches the key directly from the Supabase dashboard into `.env.local` (gitignored) — it never touches Vercel's env-pull bundle.
- In a real production setup you'd take this further: ingestion runs as a Vercel Function or scheduled cron (so the service-role key never leaves Vercel's secure injection), and the local ingestion path is removed entirely.

The chat and eval routes don't need the service-role key for reads — they could be downgraded to the anon key with appropriate Postgres `SELECT` policies on the `documents` table. We use the service-role key server-side for simplicity. No direct browser-to-database access exists; the public write routes (`/api/feedback`, `/api/eval/runs`) validate payloads inside Route Handlers and would be auth-gated and per-route rate-limited in production. Splitting credentials by route — read-only for chat, write-only for feedback, admin-only for eval-history persistence — is a hardening step but not a runtime correctness requirement at this scope.

**Row Level Security is enabled on the `documents` table with no policies attached — defense in depth.** Our reads go through the service-role key which bypasses RLS, so functionality isn't affected. But because RLS is on, the `anon` or `publishable` keys can't read the table either. If client-side reads are ever introduced, the absence of an explicit `SELECT` policy fails closed instead of leaking. This is the Supabase-recommended default and the same pattern you'd want on any internal Postgres table that doesn't need direct browser access.

## Known risks with the comprehensive corpus

Expanding from a scoped Library-only subset to the full Clever developer docs corpus introduced trade-offs I deliberately took on. These are worth knowing about — and most of them have a planned mitigation that hasn't shipped yet.

| Risk | What can go wrong | Current mitigation | What I'd add for prod |
|---|---|---|---|
| **Audience confusion** — an indie dev could be told how to set up Secure Sync without realizing they can't actually do it themselves | A developer wastes time pursuing the wrong integration path | System prompt has explicit AUDIENCE ROUTING rules: when answering district-tier questions (Secure Sync, LMS Connect), the model must surface the ASM requirement and suggest the self-serve alternative when relevant. Eval Q13 tests this behavior end-to-end. | An onboarding step that asks the user about their use case once and persists the context (e.g. "you're an indie dev building a Library integration") — used to bias retrieval and to tailor the audience-routing prompt |
| **Topic-adjacent retrieval drift** — "What is Secure Sync?" pulls LMS Connect chunks because both are district-level products | Answer technically correct but sourced from the wrong neighborhood of the corpus, which can erode citation trust | Top-5 retrieval surfaces all close matches and the model picks the most relevant. The eval's "cites_source" dimension catches gross misattribution. | Hybrid retrieval (BM25 + semantic) so exact title/term matches outrank semantic adjacency. Or per-section pre-filtering when the query keyword is unambiguous (e.g. "secure sync" → restrict to Secure Sync URLs). |
| **Stale corpus** — Clever updates docs and our snapshot drifts | Confidently wrong answers about features that have changed | None today — corpus is a one-time snapshot from when ingestion ran | Daily Vercel Cron that re-fetches the sitemap, content-hashes each chunk, and re-embeds only what changed (fast and cheap). Plus a published "last-ingested-at" timestamp shown in the UI footer. |
| **Larger embedding bill on re-ingest** | Cost grows with corpus size on full re-runs | Negligible at this scale (~770 chunks × ~1k tokens × $0.02/1M = $0.015 per full re-ingest) | Same content-hash incremental approach — only changed chunks get re-embedded. Production scale (millions of chunks) makes this essential. |
| **JSON-unsafe Unicode in scraped content** | Ingestion crashes on pages with malformed UTF-16 surrogate sequences | Strip lone surrogates before insertion (see `scripts/ingest.ts`). Lossy but safe; no displayable content is affected. | Better: detect and log the source URLs that needed sanitization. Lone surrogates often indicate broken upstream data — the docs team should know. |

The throughline: every one of these is "make the model and the prompt smarter" rather than "make the corpus smaller." Smaller corpus is the easy answer, but it also makes the product less useful.

## Production thinking

- **Observability:** structured logging on every chat request (query, retrieved similarities, answer length, model latency) into a sink like Vercel Logs / Datadog. Critical to spot retrieval drift.
- **Re-ingestion strategy:** content-hash each chunk, only re-embed changed chunks on doc updates. A daily Vercel Cron polling the dev.clever.com sitemap for changes.
- **Rate limiting:** Upstash Redis sliding-window limiter at 20 requests / 60s per IP on `/api/chat`. Blocked requests return 429 before any AI Gateway cost is incurred. (Shipped.)
- **Pre-flight guardrails:** a lightweight `gpt-4o-mini` classifier categorizes every query as on-topic / off-topic / harmful / nonsense *before* RAG runs. Off-topic and harmful queries get a canned response and skip retrieval entirely, saving tokens and giving users an appropriate message instead of an unhelpful "I couldn't find that." (Shipped.)
- **Eval in CI:** the CLI script (`pnpm eval`) is set up to run against a deployed environment; gating PRs on eval pass-rate prevents silent regressions when changing prompts, models, or chunking.
- **A model fallback chain via the AI Gateway:** if the primary model returns an error, automatically retry against a secondary. Vercel AI Gateway supports this natively.
- **Admin auth on demo surfaces:** `/eval`, `/eval/history`, and `/feedback` are intentionally open in this iteration so anyone evaluating the system can inspect quality, cost, and doc-gap signals firsthand. In production they'd sit behind admin auth (Clerk via the Vercel Marketplace) with additional rate limits on `/api/eval`, `/api/eval/runs`, and `/api/feedback`.

## Project structure

```
src/
  app/
    api/
      chat/route.ts          # Streaming chat: rate-limit, classify, RAG, stream
      feedback/route.ts      # User "flag for review" submission endpoint
      eval/route.ts          # Single-question eval (run + LLM-as-judge)
      eval/runs/route.ts     # Persist / list eval runs
    about/page.tsx           # Architecture walkthrough
    eval/page.tsx            # Live eval dashboard, side-by-side model comparison
    eval/history/page.tsx    # Saved eval runs with score trends + sparklines
    feedback/page.tsx        # Admin queue: low-confidence retrievals + user reports
    page.tsx                 # Chat UI
    layout.tsx
  components/
    Nav.tsx                  # Shared header navigation
  lib/
    rag.ts                   # Embed, retrieve, build system prompt
    guardrails.ts            # Pre-flight query classifier (on/off-topic/harmful)
    rate-limit.ts            # Upstash sliding-window rate limiter
    feedback.ts              # Fire-and-forget feedback writes
    eval-runs.ts             # Eval run persistence + summary aggregation
    supabase.ts              # Lazy Supabase client
scripts/
  ingest.ts                  # Scrape → chunk → embed → store
  setup-db.sql               # Schema (documents, feedback, eval_runs, eval_results)
eval/
  questions.json             # 15-question test set with criteria
  run-eval.ts                # CLI eval (for CI / regression testing)
```

## Local development

### Prerequisites
- Node 22+, pnpm
- A Vercel AI Gateway API key (https://vercel.com/[team]/~/ai-gateway/api-keys)
- A Supabase project with the schema in `scripts/setup-db.sql` applied (tables: `documents`, `eval_runs`, `eval_results`, `feedback`)
- An Upstash Redis instance (Vercel Marketplace provisions one; provides `KV_REST_API_URL` and `KV_REST_API_TOKEN`)
- Recommended: `vercel link` followed by `vercel env pull` so all env vars come from your linked Vercel project in one step

### Setup
```bash
pnpm install
cp .env.local.example .env.local
# Fill in AI_GATEWAY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
# KV_REST_API_URL, KV_REST_API_TOKEN
# (Or `vercel env pull` to pull them all at once.)

# One-time: ingest the docs
pnpm ingest

# Start the dev server
pnpm dev
```

### Run the eval (CLI)
```bash
pnpm eval
# Writes results to eval/results.json
```

The same eval — but with side-by-side comparison across multiple models — is available at `/eval` in the deployed app.

## Eval test set

15 hand-picked questions spanning the full platform: Library SSO, certification, data fields, multi-role users, error codes, OAuth flows, the data model, and the audience-routing boundary (Q13: Secure Sync — the assistant should *answer* the documentation question **and** surface that Secure Sync requires a Clever Application Success Manager). Q16 is the genuine out-of-corpus test (account-specific support ticket — the assistant should decline and redirect to dev.clever.com). See `eval/questions.json`.

Each answer is scored by an LLM-as-judge (`anthropic/claude-sonnet-4.6` — deliberately a different model family from two of three candidates to reduce same-family rating bias) on five rubric dimensions:
1. **Correct** — nothing in the answer is factually wrong (maps to "must" criteria in the test set)
2. **Complete** — the answer covers the required points (maps to "should" criteria)
3. **Cites source** — does the answer reference a source doc?
4. **No hallucination** — does the answer avoid fabricating information?
5. **Formatting** — is the answer well-formed markdown (headers spaced, lists prefixed with `- `, code in backticks)?

`Correct` and `complete` are kept separate on purpose. An answer like *"Yes, Clever Library is free to build on"* is *correct* — but if it omits the required *"you must offer free/freemium to end users"* clause, it's *incomplete*. Conflating these two failure modes hides actionable signal: incomplete answers are usable; wrong answers are dangerous.

Using a fixed judge across all candidates keeps comparisons fair (we measure model quality, not judge variance).

## License

MIT
