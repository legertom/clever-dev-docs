# Clever Dev Docs RAG Assistant

A RAG-powered chat assistant for Clever's developer documentation, built as a Vercel Solutions Architect take-home (Track B: AI Cloud).

**Live demo:** https://clever-dev-docs.vercel.app
**Eval dashboard:** https://clever-dev-docs.vercel.app/eval

---

## The problem

Developers building integrations for the [Clever Library](https://clever.com/library) frequently get stuck during integration and certification, generating support tickets for questions already answered in the public docs at [dev.clever.com](https://dev.clever.com). The existing support widget routes through a decision tree to human agents, and the existing search returns articles, not answers.

This assistant lets developers ask natural-language questions about Library SSO, rostering, certification, and the Clever API, and get cited answers grounded in the official docs.

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
                  1. embed query (text-embedding-3-small)
                              │
                              ▼
                  2. cosine search via Supabase pgvector
                              │
                              ▼
                  3. build system prompt with retrieved chunks
                              │
                              ▼
                  4. stream completion via Vercel AI Gateway
                     ↓
              [openai/gpt-4o-mini] (default)
              [openai/gpt-5.4]      (eval comparison)
              [anthropic/claude-haiku-4.5] (eval comparison)
```

### Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | Required by assessment. Server Components for the shell, Route Handlers for streaming. |
| AI SDK | Vercel AI SDK v6 | Required. Provider-agnostic, streaming-first. |
| Model routing | **Vercel AI Gateway** | One env var (or OIDC on Vercel) for all providers. Cross-provider eval needs zero code changes. |
| Default LLM | `openai/gpt-4o-mini` | Cheap and fast. For RAG, retrieval quality matters more than model size. |
| Embeddings | `openai/text-embedding-3-small` | $0.02/1M tokens. Best cost/quality for this corpus size (~70 chunks). |
| Vector store | **Supabase Postgres + pgvector** | Provisioned via Vercel Marketplace. Production-grade, generous free tier, HNSW index for fast ANN search. |
| Hosting | Vercel | Required. Fluid Compute functions, OIDC auth for AI Gateway. |

### Key architectural decisions

**1. Scoped corpus.** I deliberately excluded Secure Sync, LMS Connect, and Attendance docs from the ingestion. Those integration paths require an Application Success Manager and aren't accessible to the indie/vibe-coder audience this assistant serves. A focused corpus = higher retrieval precision + fewer hallucination vectors.

**2. AI Gateway over direct provider SDKs.** Going through `@ai-sdk/gateway` (rather than `@ai-sdk/openai`) means: one API key handles all providers, OIDC auth on deployed Vercel functions (no key in env vars), and the `/eval` page can compare OpenAI vs Anthropic with a single string change.

**3. Confidence-based fallback.** When the top retrieval similarity is below 0.6, the system prompt switches to a fallback that explicitly tells the model to admit it doesn't know and direct the developer to support. Hallucinating certification requirements could waste a developer weeks on a bad submission.

**4. Live eval, not just CI eval.** A `/eval` page that interviewers can click during the demo is more compelling than a CLI eval that ran "trust me, last week." It also matches how a real customer team would think about continuous evaluation.

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

The chat and eval routes themselves don't need the service-role key for reads — they could be downgraded to the anon key with appropriate Postgres `SELECT` policies on the `documents` table. We use the service-role key here for simplicity, since this project has no public write paths.

**Row Level Security is enabled on the `documents` table with no policies attached — defense in depth.** Our reads go through the service-role key which bypasses RLS, so functionality isn't affected. But because RLS is on, the `anon` or `publishable` keys can't read the table either. If client-side reads are ever introduced, the absence of an explicit `SELECT` policy fails closed instead of leaking. This is the Supabase-recommended default and the same pattern you'd want on any internal Postgres table that doesn't need direct browser access.

## Production thinking (what I'd add for a real prod deployment)

- **Observability:** structured logging on every chat request (query, retrieved similarities, answer length, model latency) into a sink like Vercel Logs / Datadog. Critical to spot retrieval drift.
- **Re-ingestion strategy:** content-hash each chunk, only re-embed changed chunks on doc updates. A daily Vercel Cron polling the dev.clever.com sitemap for changes.
- **Rate limiting:** Upstash + middleware on `/api/chat` to prevent abuse. The assessment scope skipped this.
- **Low-confidence response logging:** stream every "I couldn't find an answer" response into a queue. These are the biggest signal of doc gaps — the support team should see them.
- **Eval in CI:** the CLI script (`pnpm eval`) is set up to run against a deployed environment; gating PRs on eval pass-rate prevents silent regressions when changing prompts, models, or chunking.
- **A model fallback chain via the AI Gateway:** if the primary model returns an error, automatically retry against a secondary. Vercel AI Gateway supports this natively.

## Project structure

```
src/
  app/
    api/
      chat/route.ts       # Streaming chat with RAG + fallback
      eval/route.ts       # Single-question eval endpoint
    eval/page.tsx         # Live eval dashboard with side-by-side comparison
    page.tsx              # Chat UI
    layout.tsx
  lib/
    rag.ts                # Embed, retrieve, build system prompt (shared)
    supabase.ts           # Lazy Supabase client
scripts/
  ingest.ts               # Scrape → chunk → embed → store
  setup-db.sql            # Schema (also applied via Supabase MCP)
eval/
  questions.json          # 15-question test set with criteria
  run-eval.ts             # CLI eval (for CI / regression testing)
```

## Local development

### Prerequisites
- Node 22+, pnpm
- A Vercel AI Gateway API key (https://vercel.com/[team]/~/ai-gateway/api-keys)
- A Supabase project with the schema in `scripts/setup-db.sql` applied
- Optional: `vercel link` followed by `vercel env pull` to pull env vars from your linked Vercel project

### Setup
```bash
pnpm install
cp .env.local.example .env.local
# Fill in AI_GATEWAY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

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

15 hand-picked questions covering Library SSO, certification, data fields, multi-role users, error codes, and one out-of-scope question (Secure Sync) to test the fallback boundary. See `eval/questions.json`.

Each answer is scored by an LLM-as-judge (`openai/gpt-4o-mini`) on three rubric dimensions:
1. **Correct** — does the answer reflect what the docs actually say?
2. **Cites source** — does the answer reference a source doc?
3. **No hallucination** — does the answer avoid fabricating information?

Using a fixed judge across all candidate models keeps comparisons fair (we measure model quality, not judge variance).

## License

MIT
