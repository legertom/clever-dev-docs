import {
  retrieveRelevantChunks,
  retrieveRelevantChunksHybrid,
  type DocumentChunk,
} from "@/lib/rag";

export const maxDuration = 30;

interface CompareBody {
  query?: string;
  matchCount?: number;
  matchThreshold?: number;
}

interface ChunkSummary {
  url: string;
  title: string;
  similarity: number;
  integration_path?: string;
  snippet: string;
}

function summarize(chunks: DocumentChunk[]): ChunkSummary[] {
  return chunks.map((c) => ({
    url: c.url,
    title: c.title,
    similarity: c.similarity,
    integration_path: c.integration_path,
    snippet: c.content.slice(0, 240).replace(/\s+/g, " "),
  }));
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as CompareBody;
  const query = body.query?.trim();
  if (!query) {
    return Response.json({ error: "Missing 'query' in request body." }, { status: 400 });
  }

  const matchCount = body.matchCount ?? 5;
  const matchThreshold = body.matchThreshold ?? 0.5;

  const [vector, hybrid] = await Promise.all([
    retrieveRelevantChunks(query, matchCount, matchThreshold, "vector"),
    retrieveRelevantChunksHybrid(query, matchCount, matchThreshold),
  ]);

  const vectorUrls = new Set(vector.map((c) => c.url));
  const hybridUrls = new Set(hybrid.map((c) => c.url));

  return Response.json({
    query,
    vector: {
      topSimilarity: vector[0]?.similarity ?? 0,
      count: vector.length,
      chunks: summarize(vector),
    },
    hybrid: {
      topSimilarity: hybrid[0]?.similarity ?? 0,
      count: hybrid.length,
      chunks: summarize(hybrid),
    },
    diff: {
      onlyInVector: [...vectorUrls].filter((u) => !hybridUrls.has(u)),
      onlyInHybrid: [...hybridUrls].filter((u) => !vectorUrls.has(u)),
      inBoth: [...vectorUrls].filter((u) => hybridUrls.has(u)),
    },
  });
}
