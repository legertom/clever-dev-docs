import { createHash } from "crypto";
import { getSupabase } from "./supabase";

export interface EvalResultRow {
  question_id: number;
  question: string;
  model: string;
  answer: string;
  correct: boolean;
  complete: boolean;
  cites_source: boolean;
  no_hallucination: boolean;
  formatting: boolean;
  reasoning?: string;
  retrieved_urls?: string[];
  top_similarity?: number;
  duration_ms?: number;
  cost_usd?: number;
  input_tokens?: number;
  output_tokens?: number;
}

export interface EvalRunSummary {
  models: Record<
    string,
    {
      total: number;
      correct: number;
      complete: number;
      cites_source: number;
      no_hallucination: number;
      formatting: number;
      pass: number;
    }
  >;
}

export interface ChunkConfig {
  match_count: number;
  match_threshold: number;
  retrieval_mode?: "vector" | "hybrid";
}

export interface SavedEvalRun {
  id: string;
  created_at: string;
  label: string | null;
  models: string[];
  total_questions: number;
  summary: EvalRunSummary;
  system_prompt_hash: string | null;
  chunk_config: ChunkConfig | null;
}

export function hashSystemPromptTemplate(template: string): string {
  return createHash("sha256").update(template).digest("hex").slice(0, 12);
}

function buildSummary(results: EvalResultRow[]): EvalRunSummary {
  const models: EvalRunSummary["models"] = {};

  for (const r of results) {
    if (!models[r.model]) {
      models[r.model] = {
        total: 0,
        correct: 0,
        complete: 0,
        cites_source: 0,
        no_hallucination: 0,
        formatting: 0,
        pass: 0,
      };
    }
    const m = models[r.model];
    m.total++;
    if (r.correct) m.correct++;
    if (r.complete) m.complete++;
    if (r.cites_source) m.cites_source++;
    if (r.no_hallucination) m.no_hallucination++;
    if (r.formatting) m.formatting++;
    if (r.correct && r.no_hallucination) m.pass++;
  }

  return { models };
}

export async function saveEvalRun(opts: {
  label?: string;
  results: EvalResultRow[];
  systemPromptHash?: string;
  chunkConfig?: ChunkConfig;
}): Promise<string> {
  const models = [...new Set(opts.results.map((r) => r.model))];
  const questionIds = new Set(opts.results.map((r) => r.question_id));
  const summary = buildSummary(opts.results);

  const { data: run, error: runError } = await getSupabase()
    .from("eval_runs")
    .insert({
      label: opts.label ?? null,
      models,
      total_questions: questionIds.size,
      summary,
      system_prompt_hash: opts.systemPromptHash ?? null,
      chunk_config: opts.chunkConfig ?? null,
    })
    .select("id")
    .single();

  if (runError || !run) {
    throw new Error(`Failed to create eval run: ${runError?.message}`);
  }

  const rows = opts.results.map((r) => ({
    run_id: run.id,
    ...r,
  }));

  const { error: resultsError } = await getSupabase()
    .from("eval_results")
    .insert(rows);

  if (resultsError) {
    throw new Error(`Failed to insert eval results: ${resultsError.message}`);
  }

  return run.id;
}

export async function listEvalRuns(
  limit = 50
): Promise<SavedEvalRun[]> {
  const { data, error } = await getSupabase()
    .from("eval_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list eval runs: ${error.message}`);
  }

  return data ?? [];
}

export async function getEvalRun(
  runId: string
): Promise<{ run: SavedEvalRun; results: EvalResultRow[] } | null> {
  const [runRes, resultsRes] = await Promise.all([
    getSupabase().from("eval_runs").select("*").eq("id", runId).single(),
    getSupabase()
      .from("eval_results")
      .select("*")
      .eq("run_id", runId)
      .order("question_id", { ascending: true }),
  ]);

  if (runRes.error || !runRes.data) return null;

  return {
    run: runRes.data,
    results: resultsRes.data ?? [],
  };
}
