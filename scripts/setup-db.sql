-- Enable the pgvector extension (Supabase includes this by default)
create extension if not exists vector;

-- Documents table: each row is one chunk of documentation
create table if not exists documents (
  id bigserial primary key,
  content text not null,
  url text not null,
  title text not null,
  chunk_index integer not null,
  integration_path text not null default 'general',
  embedding vector(1536) -- text-embedding-3-small outputs 1536 dimensions
);

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

-- Similarity search function used by the RAG retrieval layer.
-- Returns the top N most relevant chunks for a given query embedding.
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
    d.id,
    d.content,
    d.url,
    d.title,
    d.chunk_index,
    d.integration_path,
    1 - (d.embedding <=> query_embedding) as similarity
  from documents d
  where 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
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
