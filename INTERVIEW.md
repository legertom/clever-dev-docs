# Interview Demo Script & Talking Points

A 15–20 minute Solutions Architect-style demo for Vercel.

The structure follows the rubric explicitly: **Problem Framing → Architecture → Live Demo → Production Thinking → Vercel Platform Value**, ending in Q&A.

---

## Opening (90 seconds) — Problem Framing

> "I work in support at Clever. Clever connects 75% of US K-12 districts to thousands of edtech apps via SSO, rostering, and APIs. We see hundreds of developer support tickets every quarter — and a meaningful fraction of them are from indie developers integrating with Clever Library, asking questions that are already answered in our public documentation at dev.clever.com.
>
> The audience here is what we'd call 'vibe coders' — indie developers building a small classroom app, doing a Library integration, going through certification. They're not enterprise customers with an Application Success Manager. When they get stuck at 11pm, the existing support widget routes them through a decision tree to a human agent who isn't online. The existing search returns articles, not answers. So they either wait, file a ticket, or give up.
>
> What I built is a RAG-powered assistant that answers natural-language questions about Clever Library, SSO, certification, and the Clever API — grounded in the official docs, with citations. Let me show you."

**Key framing for the rubric:**
- Clear "why" (real support load, real audience pain)
- Defined audience (indie/vibe-coder devs, not enterprise)
- Picture of success (deflect tickets, unblock devs, faster certification)

---

## Live Chat Demo (3 minutes)

Open https://clever-dev-docs.vercel.app

**Question 1 — happy path with citation:**
> "Is Clever Library free to build on?"

Watch streaming response. Point out: "Notice the citation — it links back to the source doc. This is critical for trust. A developer can verify the answer or dig deeper."

**Question 2 — multi-turn context:**
> "What about student email?"

Notice it understood "what about" referred to data fields available in Library (from prior context). "Multi-turn matters because devs ask follow-ups — they're not running isolated queries."

**Question 3 — out-of-scope fallback (the most important demo):**
> "How do I set up Secure Sync?"

The assistant declines, says it's outside its scope, suggests Clever support.

> "This is the most important behavior. Hallucinated answers about certification or compliance could waste a developer weeks on a bad submission. So I built a confidence threshold: when retrieval similarity drops below 0.6, the system prompt switches modes and explicitly tells the model not to improvise. The cost of a wrong answer here is much higher than the cost of saying 'I don't know.'"

---

## Architecture Walkthrough (4 minutes)

Open the GitHub repo, walk through the README architecture diagram.

**Stack at a glance:**
- Next.js 16 App Router → Server Components for shell, Route Handlers for streaming
- Vercel AI SDK v6 → `streamText`, `useChat`, `convertToModelMessages`
- **Vercel AI Gateway** as the model router — single API for OpenAI, Anthropic, Google, hundreds more
- `openai/gpt-4o-mini` for chat — chosen deliberately, not by default
- `openai/text-embedding-3-small` for embeddings — 1536 dim, $0.02/1M tokens
- Supabase + pgvector via **Vercel Marketplace** — HNSW index for ANN search
- Deployed on Vercel with Fluid Compute

**Four architectural decisions worth highlighting:**

### 1. Scoped corpus, not "all the docs"

> "I deliberately excluded Secure Sync, LMS Connect, and Attendance Data from the corpus. Those are enterprise integration paths that require an Application Success Manager — they're not what an indie developer is doing. A focused corpus means higher retrieval precision and fewer vectors that could drag in irrelevant context. The smallest defensible scope wins."

### 2. AI Gateway over provider SDKs

> "Going through `@ai-sdk/gateway` instead of `@ai-sdk/openai` means I have one auth mechanism, one observability surface, and zero code changes to swap providers. I'll show you the actual proof on the eval page in a minute. In production this also means OIDC tokens — no API keys live in Vercel env vars at all."

### 3. Confidence-based fallback

> "There's a similarity threshold check before the model generates. Below 0.6 similarity on the top retrieval result, the system prompt switches to a fallback that says 'tell the developer you couldn't find it in the docs and direct them to support.' This is what protects us from hallucinated certification requirements. Saying 'I don't know' is a feature, not a bug."

### 4. Live eval is part of the product, not just a CI script

> "There's also a CLI eval at `pnpm eval` for CI gating. But putting an eval *page* in the deployed app means I can show you, right now, what the system is actually doing — not 'trust me, this passed last week.'"

---

## /eval Page Demo (3 minutes) — The Killer Feature

Navigate to https://clever-dev-docs.vercel.app/eval

> "This page runs the same 15-question test set against three different models in parallel: gpt-4o-mini, gpt-5.4, and Claude Haiku 4.5 — all routed through the AI Gateway. Each answer is scored on four rubric dimensions: correct, complete, cites source, and no hallucination. The judge is Claude Sonnet 4.6 — deliberately a different family than the OpenAI candidates, which eliminates the same-family rating bias you'd get if you used GPT to judge GPT. And every result shows the actual USD cost it took to produce it.
>
> Quick note on why correct and complete are separate dimensions. An answer like 'Yes, Clever Library is free to build on' is correct — but if it omits the required 'you must offer freemium to end users' caveat, it's incomplete. Those are different failure modes with different consequences: incomplete is annoying, wrong is dangerous. Splitting them lets us optimize for each independently."
>
> Click Run."

While running:

> "Three things to notice. One: the cross-provider comparison — OpenAI versus Anthropic — is a string change in the allowlist. No Anthropic SDK installed, no code refactor. The Gateway abstracts the provider. Two: I'm intentionally comparing a cheap model — gpt-4o-mini — against a flagship — gpt-5.4. Three: notice the cost column. Each row shows USD cost computed from real token usage and current AI Gateway pricing."

When the eval finishes — concrete numbers from a representative run:

> "Here's the trade-off in dollars. On the question 'What's the difference between Clever Library and Clever Single Sign-On?' — a question that requires actual reasoning over context, not just retrieval — gpt-4o-mini cost $0.00028 and got the answer wrong. gpt-5.4 cost $0.00817 — about 29 times more — and got it right. Claude Haiku 4.5 cost $0.00296, about 10 times more, also right.
>
> So 'cheap always wins' is the wrong takeaway. The honest takeaway is: cheap wins on factual lookups where the doc literally says the answer. The flagship is worth it on questions that require synthesis across chunks. Without the eval, you'd never see that. You'd just hear users complain.
>
> If I were running this in production, the architecture would be: route easy queries to gpt-4o-mini by default, escalate to a more expensive model only when a confidence signal — embedding similarity, output length, or a learned classifier — says the question is hard. That's an A/B testable decision and the eval is the harness for testing it."

When the eval finishes:

> "If you were on a customer team, this is the page you'd watch when you change a chunk size, swap a prompt, or update the corpus. Continuous evaluation is what keeps RAG honest as the system evolves — and surfacing cost makes the trade-off impossible to ignore."

---

## Production Thinking (2 minutes)

Talk through the "Production thinking" section of the README:

- **Observability:** structured logging on every request — query, retrieved similarities, latency, model — into Vercel Logs / Datadog. Without this you can't tell if retrieval is degrading.
- **Re-ingestion:** content-hash chunks, only re-embed what changed. Daily Vercel Cron polls the dev.clever.com sitemap for diffs.
- **Rate limiting:** Upstash + middleware on `/api/chat`. Public endpoints with LLM calls behind them get expensive fast under abuse.
- **Low-confidence response queue:** every "I couldn't find it" gets logged. These are the strongest signal of doc gaps — the support team should see them.
- **Eval in CI:** the `pnpm eval` script gates PRs on pass-rate. Prevents silent regressions when prompts/models/chunking change.

Optional but high-value mention: **Security posture** (from the README's Security section) — sensitive env vars, RLS-by-default, OIDC for AI Gateway, scoped credential surface.

---

## Vercel Platform Value (anchored to specific decisions)

This is what makes it a Vercel SA demo, not just an AI demo. Hit these explicitly:

| Decision | Vercel feature it leverages |
|---|---|
| One env var (or zero) for all model providers | **AI Gateway** — unified API, OIDC auth on deploy |
| One-click Supabase + auto-injected env vars | **Vercel Marketplace** native integration |
| Service-role key marked Sensitive, never readable from dashboard | **Vercel env var Sensitive flag** |
| Push-to-deploy, preview URL per PR | **Git integration** + preview deployments |
| Cross-provider eval is a string change | **AI Gateway model routing** (no SDK install) |
| Ingestion script is configurable but the deploy doesn't need to redo it | Static doc corpus + dynamic Vercel Functions |
| `streamText` returning `toUIMessageStreamResponse()` | **Fluid Compute** (Node.js streaming, generous timeouts) |

> "The thing I want to emphasize is that none of these decisions were Vercel-for-Vercel's-sake. Each one is solving an actual problem the architecture needed to solve — and Vercel happens to make those problems easier than the alternatives. The Marketplace gave me the database in three clicks. The AI Gateway gave me cross-provider routing without a refactor. The Sensitive env var flag gave me a defensible secret-handling story. These compound. By the time I was ready to ship, I was 80% of the way to the answer that a Vercel customer team would have built."

---

## Anticipated Q&A

### Why pgvector instead of a dedicated vector DB (Pinecone, Weaviate, Qdrant)?

> "For this corpus size — about 200 chunks — pgvector is cheaper, operationally simpler, and one less service to monitor. HNSW search is sub-100ms even on a free tier instance. I'd migrate to a dedicated vector DB at the point retrieval latency becomes a bottleneck, or when I want richer query capabilities like hybrid search or metadata filters at scale. For a corpus that's growing slowly, the migration cost is real and the value is marginal."

### Why gpt-4o-mini over gpt-5.4 for the production default?

> "Cost. gpt-4o-mini is roughly 25-30x cheaper per query than gpt-5.4 — about $0.0003 vs $0.008 on a typical RAG question. For most factual lookups in our docs, the cheap model is sufficient because the retrieved context is doing the heavy lifting. The eval shows where it isn't, and those are the questions where you'd want to escalate. The point of starting with the cheap model isn't that it's always best — it's that the eval tells you exactly which questions need the upgrade, instead of paying the flagship price for every query as insurance."

### How does the eval know if an answer is hallucinating?

> "Honest answer: it uses an LLM-as-judge — a second model call that reads the question, the candidate's answer, the expected answer, and the retrieved source URLs, and gives a yes/no on three rubric dimensions including hallucination. The judge is Claude Sonnet 4.6, deliberately a different model family than two of three candidates so we're not getting same-family rating bias.
>
> What it catches well: flagrant inventions, confident factual claims that contradict the expected answer.
>
> What it doesn't catch: subtle hallucinations where the answer is plausible but unverified — because right now the judge only sees source URLs, not the actual chunk text. To fix that I'd pass the retrieved chunk content into the judge prompt, then ask 'is each claim in this answer supported by this context?' That's the standard claim-level entailment pattern that RAGAS and TruLens implement. It's a 30-minute change. I left it out for the demo to keep judge tokens cheap, but it's the first thing I'd ship next."

### How does the eval run 45 model calls so fast?

> "Worker-pool concurrency, not naive batching. Easiest way to explain: imagine a grocery store with 5 cashiers and 15 customers.
>
> Naive batching says: 'cashiers, ring up customers 1-5. When ALL of you are done, then start on 6-10.' Problem: if customer 3 has a coupon mess that takes 8 minutes, the other 4 cashiers stand idle waiting before any of them can call the next customer.
>
> Worker pool says: 'whenever ANY cashier becomes free, they call the next number.' Cashiers are never idle while there's work to do.
>
> Same applies here. Five worker async functions each run a while-loop that pulls the next question off a shared index. LLM call latency has high variance — the Claude Sonnet judge can take 2-8 seconds — so naive batching would leave four workers waiting on every slow outlier. Worker pool eliminates that. End-to-end time is bounded by total_work ÷ N rather than slowest_per_batch × num_batches.
>
> The general principle: any time you have variable-latency work and a fixed concurrency budget, a worker pool beats Promise.all over chunks."

### What's the cost at scale?

> "Per query, measured live in the eval: about $0.0003 with gpt-4o-mini, including the retrieval-augmented context. The embedding step is about $0.00001 — negligible. Vector search is free. So the dominant cost is the LLM completion.
>
> At 100k queries per month — well above what Clever Library volume would realistically generate — that's $30 per month in inference. Add Supabase free tier and Vercel Pro and the entire system runs for under $50 a month at that scale. If we routed 10% of queries to gpt-5.4 as a smart-escalation path, we'd add maybe $20 more. The cost story is genuinely incidental — the deflection-of-support-tickets metric is what justifies the product."

### How would you handle docs being updated?

> "Two parts. First, content-hash each chunk during ingestion — only re-embed chunks whose content changed. Second, schedule a daily Vercel Cron to fetch the sitemap, diff it against the previous run, and re-ingest only changed pages. This avoids the $50 of re-embedding cost every time someone fixes a typo."

### Why didn't you fine-tune a model on the docs?

> "Fine-tuning works for stable patterns and structured outputs. RAG works for changing facts. Clever's docs are updated frequently — new APIs, deprecated fields, new compliance requirements — and a fine-tuned model would go stale immediately and silently. RAG fails loudly: bad retrieval, no answer. That's a much safer failure mode for a customer-facing tool."

### Why is the chat route using the service-role key instead of a least-privilege read-only key?

> "For the take-home, I used Supabase's service-role key server-side to keep the data layer simple. Since the corpus is public docs, the risk is low — there's no PII or student data in the table. In production, I'd split permissions: admin ingestion can use elevated access, but regular chat queries should use least-privilege read access. Concretely, that means an `anon` key with a `SELECT`-only RLS policy on the `documents` table — the policy already scaffolds for this since RLS is enabled, just no policies attached today. The two paths having different keys also means a leaked chat-route credential can't be used to wipe or modify the corpus."

### What about SOC 2, FERPA, COPPA — Clever has strict data requirements?

> "Three things. One, the docs themselves are public — there's no student PII in the corpus, so the highest-risk data classes aren't in scope. Two, Vercel offers SOC 2 compliance and a Business Associate Agreement under their Enterprise plan, plus the AI Gateway has zero data retention by default. Three, for the Library SSO product specifically, Clever already requires partners to meet FERPA and COPPA requirements — this assistant lives upstream of that, helping developers ship a compliant integration faster."

### How do you measure success in production?

> "Three metrics. First, ticket deflection: every conversation that ends without a follow-up support ticket is a win — instrumented by querying ticket volume in Salesforce against assistant conversation IDs. Second, fallback rate: the percentage of conversations that hit the 'I don't know' path, broken down by query topic. High fallback in a topic = doc gap. Third, time-to-first-action on a Library certification — does using the assistant correlate with submitting a complete cert package faster? That's the business metric."

### What would you build next?

> "Three things in priority order. One: instrument the low-confidence queue and feed it to the docs team — turn the assistant into a feedback loop for the documentation itself. Two: integrate the assistant into the developer dashboard at clever.com so it has user context (which app are you working on, where are you in cert?) — context-aware retrieval would dramatically improve precision. Three: agentic actions — let the assistant actually trigger an environment switch, validate a payload, or open a support ticket if it can't help, instead of just talking about it."

---

## Things to NOT do during the demo

- Don't read the README out loud. Show, don't recite.
- Don't apologize for trade-offs. Own them. ("I picked the cheap model on purpose.")
- Don't run the eval cold without warming it up first — the first run for each model has a cold-start penalty that confuses the comparison.
- Don't show the code in detail unless they ask. The story is the architecture and the trade-offs, not the line-by-line.
- Don't dodge "what would you change?" — have at least one concrete thing you'd refactor (e.g., "I'd extract the query rewriting into a separate step before retrieval — currently the retrieval uses the raw last-user-message, which fails on vague follow-ups").
