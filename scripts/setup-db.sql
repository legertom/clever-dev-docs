-- Enable the pgvector extension (Supabase includes this by default)
create extension if not exists vector;

-- Documents table: each row is one chunk of documentation.
-- The `fts` tsvector column is a stored generated column — Postgres
-- recomputes it automatically on every insert/update, so the ingest
-- pipeline doesn't need to know about FTS. Title is weighted 'A' (highest)
-- so pages whose title contains the keyword outrank pages that merely
-- mention it in body text.
create table if not exists documents (
  id bigserial primary key,
  content text not null,
  url text not null,
  title text not null,
  chunk_index integer not null,
  integration_path text not null default 'general',
  embedding vector(1536), -- text-embedding-3-small outputs 1536 dimensions
  fts tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) stored
);

-- Existing deployments need the column added explicitly. The DO block
-- is idempotent: re-running setup-db.sql against an upgraded database
-- is a no-op.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'documents' and column_name = 'fts'
  ) then
    alter table documents add column fts tsvector generated always as (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(content, '')), 'B')
    ) stored;
  end if;
end$$;

-- Enable Row-Level Security on documents.
-- The service-role key (used by /api/chat and ingestion) bypasses RLS,
-- so runtime behavior is unchanged. This is defense-in-depth: if anon
-- or publishable keys ever gain access to this table, the absence of
-- a SELECT policy fails closed rather than leaking.
alter table documents enable row level security;

-- HNSW index for fast approximate nearest-neighbor search.
-- HNSW is preferred over IVFFlat for small-to-medium datasets (<100k rows)
-- because it requires no training step and has better recall at low row counts.
create index if not exists documents_embedding_idx
  on documents
  using hnsw (embedding vector_cosine_ops);

-- GIN index on the tsvector for fast full-text search.
-- Pairs with the HNSW index above to power hybrid retrieval: vector for
-- semantic similarity, FTS for exact-keyword recall.
create index if not exists documents_fts_idx
  on documents
  using gin (fts);

-- ── Retrieval functions ────────────────────────────────────────────────
-- Two functions back retrieval, intentionally under different names so
-- neither can shadow the other in PostgREST function-resolution. App code
-- chooses between them via the RETRIEVAL_MODE env flag (see src/lib/rag.ts).
--
--   match_documents          — vector-only (cosine similarity)
--   match_documents_hybrid   — vector + Postgres FTS, fused via RRF
--
-- Defensive cleanup: an earlier (now-superseded) migration tried to
-- replace `match_documents` with a 4-arg hybrid signature. That overload
-- is dropped here so any dev DB that ran it ends up with a single,
-- unambiguous `match_documents`. No-op against prod.
drop function if exists match_documents(vector, text, int, float);

-- Vector-only retrieval. Kept as the default and as the hot path used by
-- /api/chat under `RETRIEVAL_MODE=vector` (the default).
create or replace function match_documents(
  query_embedding vector(1536),
  match_count int default 5,
  match_threshold float default 0.5
)
returns table (
  id bigint,
  content text,
  url text,
  title text,
  chunk_index integer,
  integration_path text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    d.id, d.content, d.url, d.title, d.chunk_index, d.integration_path,
    1 - (d.embedding <=> query_embedding) as similarity
  from documents d
  where 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Hybrid retrieval function.
--
-- Runs two independent rankings in parallel:
--   • vector_pool — top-N by cosine similarity against `query_embedding`
--   • fts_pool    — top-N by ts_rank_cd against `query_text` (websearch syntax)
--
-- Combines them with Reciprocal Rank Fusion (RRF, k=60), the standard
-- score-agnostic fusion algorithm. RRF doesn't care that cosine similarity
-- and ts_rank_cd live in different number spaces — it only cares about
-- each chunk's rank within its own ranker.
--
-- The returned `similarity` is the *stronger* of the two signals expressed
-- on a 0–1 scale. For vector-only matches, that's raw cosine similarity.
-- For FTS-rescued matches (where embedding similarity was deceptively low
-- because the evidence sits in code/JSON), the rank position maps to a
-- confidence value designed to pass the application-side 0.6 confidence
-- gate — so a chunk that exact-matched the query at rank 1 doesn't get
-- thrown away just because the embedding model under-scored it.
--
-- `vec_sim` is also returned separately: the raw cosine similarity
-- without rescue inflation. The chat route uses this (not the rescued
-- `similarity`) to decide whether to log a low_confidence feedback
-- row, so the doc-gap alarm tracks actual semantic match quality
-- rather than always-inflated rescue scores.

-- Return signature changed (added vec_sim column). Drop first so
-- `create or replace` doesn't error on the signature mismatch.
drop function if exists match_documents_hybrid(vector, text, int, float);

create or replace function match_documents_hybrid(
  query_embedding vector(1536),
  query_text text default null,
  match_count int default 5,
  match_threshold float default 0.5
)
returns table (
  id bigint,
  content text,
  url text,
  title text,
  chunk_index integer,
  integration_path text,
  similarity float,
  vec_sim float
)
language plpgsql
as $$
declare
  ts_query tsquery := null;
  pool_size int := greatest(match_count * 4, 20);
begin
  -- Build a stopword-stripped, OR-joined tsquery from query_text.
  --
  -- Why not websearch_to_tsquery: it ANDs all content words, so a
  -- natural-language question like "is the created date shared by
  -- default?" demands a single chunk containing 'created' AND 'date'
  -- AND 'shared' AND 'default' — almost no chunk does, killing recall.
  -- to_tsvector handles tokenization, stemming, and English-stopword
  -- removal for free, and joining the surviving lexemes with ' | '
  -- admits any chunk matching at least one keyword. ts_rank_cd then
  -- promotes chunks with more overlap to the top.
  if query_text is not null and length(trim(query_text)) > 0 then
    select string_agg(lexeme, ' | ')::tsquery
    into ts_query
    from unnest(tsvector_to_array(to_tsvector('english', query_text))) as lexeme
    where lexeme <> '';
  end if;

  return query
  with vector_pool as (
    select
      d.id,
      1 - (d.embedding <=> query_embedding) as vec_sim,
      row_number() over (order by d.embedding <=> query_embedding) as vec_rank
    from documents d
    order by d.embedding <=> query_embedding
    limit pool_size
  ),
  fts_pool as (
    select
      d.id,
      ts_rank_cd(d.fts, ts_query) as fts_score,
      row_number() over (order by ts_rank_cd(d.fts, ts_query) desc) as fts_rank
    from documents d
    where ts_query is not null and d.fts @@ ts_query
    order by ts_rank_cd(d.fts, ts_query) desc
    limit pool_size
  ),
  fused as (
    select
      coalesce(v.id, f.id) as id,
      coalesce(v.vec_sim, 0) as vec_sim,
      v.vec_rank,
      f.fts_rank,
      -- RRF fused score, used purely for final ordering.
      coalesce(1.0 / (60 + v.vec_rank), 0)
        + coalesce(1.0 / (60 + f.fts_rank), 0) as rrf_score
    from vector_pool v
    full outer join fts_pool f on v.id = f.id
  )
  select
    d.id,
    d.content,
    d.url,
    d.title,
    d.chunk_index,
    d.integration_path,
    -- "similarity" surfaced to the app. Max of (a) native cosine and
    -- (b) FTS-rank-derived confidence. The rank curve was picked so
    -- that an FTS-only top hit (rank 1) lands at 0.85, comfortably
    -- above the 0.6 confidence threshold. Drops ~0.06 per rank.
    greatest(
      fused.vec_sim,
      case
        when fused.fts_rank is null then 0
        when fused.fts_rank = 1 then 0.85
        when fused.fts_rank = 2 then 0.78
        when fused.fts_rank = 3 then 0.72
        when fused.fts_rank = 4 then 0.66
        when fused.fts_rank = 5 then 0.60
        else 0.55
      end
    ) as similarity,
    -- Raw cosine, unaffected by FTS rescue. Used by the chat route's
    -- low_confidence trigger so the doc-gap alarm reflects semantic
    -- match quality, not the rescue-inflated score.
    fused.vec_sim as vec_sim
  from fused
  join documents d on d.id = fused.id
  -- Admit a chunk if EITHER signal qualifies: vector cleared the
  -- threshold OR FTS matched at all. Without the OR, FTS rescues
  -- would still be filtered out by the cosine-based gate.
  where fused.vec_sim > match_threshold or fused.fts_rank is not null
  order by fused.rrf_score desc
  limit match_count;
end;
$$;

-- ── Eval history tables ─────────────────────────────────────
-- These power the tuning program: run evals, save scores to the DB,
-- and watch dimensions improve as you refine chunks and prompts.

-- One row per "Run Eval" execution (may cover multiple models).
create table if not exists eval_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  label text,
  models text[] not null,
  total_questions integer not null,
  summary jsonb not null default '{}',
  system_prompt_hash text,
  chunk_config jsonb
);

-- One row per (question × model) within a run.
create table if not exists eval_results (
  id bigserial primary key,
  run_id uuid not null references eval_runs(id) on delete cascade,
  question_id integer not null,
  question text not null,
  model text not null,
  answer text not null,
  correct boolean not null,
  complete boolean not null,
  cites_source boolean not null,
  no_hallucination boolean not null,
  formatting boolean not null,
  reasoning text,
  retrieved_urls text[],
  top_similarity float,
  duration_ms integer,
  cost_usd float,
  input_tokens integer,
  output_tokens integer
);

create index if not exists eval_results_run_id_idx
  on eval_results(run_id);

-- ── Feedback queue ──────────────────────────────────────────
-- Dual-signal queue for surfacing doc gaps and answer issues:
--   - kind='low_confidence' — auto-logged by /api/chat when retrieval
--     similarity falls below CONFIDENCE_THRESHOLD
--   - kind='user_report' — explicit "flag for review" submissions from
--     the chat UI via /api/feedback
--   - kind='guardrail' — queries blocked pre-RAG by the classifier
--     (off-topic / harmful / nonsense)
-- Read by /feedback admin page; written by /api/chat and /api/feedback.

create table if not exists feedback (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('low_confidence', 'user_report', 'guardrail')),
  query text,
  response text,
  user_note text,
  retrieved_urls text[],
  top_similarity float,
  category text,
  ip text
);

create index if not exists feedback_kind_idx on feedback(kind);
create index if not exists feedback_created_at_idx on feedback(created_at desc);
