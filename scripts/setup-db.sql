-- Enable the pgvector extension (Supabase includes this by default)
create extension if not exists vector;

-- Documents table: each row is one chunk of documentation
create table if not exists documents (
  id bigserial primary key,
  content text not null,
  url text not null,
  title text not null,
  chunk_index integer not null,
  embedding vector(1536) -- text-embedding-3-small outputs 1536 dimensions
);

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
    1 - (d.embedding <=> query_embedding) as similarity
  from documents d
  where 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
end;
$$;
