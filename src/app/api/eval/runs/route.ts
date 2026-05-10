import {
  saveEvalRun,
  listEvalRuns,
  type EvalResultRow,
} from "@/lib/eval-runs";

export async function POST(req: Request) {
  const body = await req.json();

  const results: EvalResultRow[] = body.results;
  if (!Array.isArray(results) || results.length === 0) {
    return Response.json(
      { error: "results array is required" },
      { status: 400 }
    );
  }

  try {
    const runId = await saveEvalRun({
      label: body.label,
      results,
      systemPromptHash: body.systemPromptHash,
      chunkConfig: body.chunkConfig,
    });

    return Response.json({ id: runId });
  } catch (err) {
    console.error("[eval/runs] save failed:", err);
    return Response.json(
      { error: "Failed to save eval run" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const runs = await listEvalRuns(50);
    return Response.json({ runs });
  } catch (err) {
    console.error("[eval/runs] list failed:", err);
    return Response.json(
      { error: "Failed to list eval runs" },
      { status: 500 }
    );
  }
}
