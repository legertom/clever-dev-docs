import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { getAllSeedUrls, CHUNKS_DIR, MANIFEST_FILE, OUTPUT_DIR } from "./config.ts";
import { crawlAll, type CrawlResult } from "./crawl.ts";
import { chunkAll, type DocChunk } from "./chunk.ts";

const isDryRun = process.argv.includes("--dry-run");

interface ManifestEntry {
  id: string;
  file: string;
  url: string;
  path: string;
  section: string;
  title: string;
  heading: string;
  parentHeadings: string[];
  tokenEstimate: number;
  chunkIndex: number;
  totalChunks: number;
}

interface Manifest {
  generatedAt: string;
  totalPages: number;
  totalChunks: number;
  totalTokenEstimate: number;
  sections: string[];
  chunks: ManifestEntry[];
}

async function main() {
  console.log("=== Clever Dev Docs Spider ===\n");

  const seeds = getAllSeedUrls();
  console.log(`Seed URLs: ${seeds.length} pages across ${new Set(seeds.map((s) => s.section)).size} sections\n`);

  if (isDryRun) {
    console.log("DRY RUN - listing pages that would be crawled:\n");
    for (const seed of seeds) {
      console.log(`  [${seed.section}] ${seed.path}`);
    }
    console.log(`\nTotal: ${seeds.length} pages`);
    return;
  }

  // Phase 1: Crawl
  console.log("Phase 1: Crawling pages...\n");
  const pages = await crawlAll(seeds);
  console.log(`\nCrawled ${pages.length} pages successfully.\n`);

  if (pages.length === 0) {
    console.error("No pages crawled. Exiting.");
    process.exit(1);
  }

  // Phase 2: Chunk
  console.log("Phase 2: Chunking content...\n");
  const allChunks = chunkAll(pages);

  // Filter out chunks that are too small to be useful (likely JS-rendered pages)
  const MIN_USEFUL_TOKENS = 30;
  const chunks = allChunks.filter((c) => c.tokenEstimate >= MIN_USEFUL_TOKENS);
  const filtered = allChunks.length - chunks.length;
  console.log(`Generated ${allChunks.length} chunks, kept ${chunks.length} (filtered ${filtered} tiny chunks).\n`);

  // Phase 3: Write output
  console.log("Phase 3: Writing output...\n");

  // Clean and recreate output directories
  if (existsSync(CHUNKS_DIR)) {
    rmSync(CHUNKS_DIR, { recursive: true });
  }
  mkdirSync(CHUNKS_DIR, { recursive: true });

  // Write individual chunk files
  for (const chunk of chunks) {
    const filePath = join(CHUNKS_DIR, `${chunk.id}.json`);
    writeFileSync(filePath, JSON.stringify(chunk, null, 2));
  }

  // Build and write manifest
  const sections = [...new Set(pages.map((p) => p.section))].sort();
  const totalTokenEstimate = chunks.reduce((sum, c) => sum + c.tokenEstimate, 0);

  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    totalPages: pages.length,
    totalChunks: chunks.length,
    totalTokenEstimate,
    sections,
    chunks: chunks.map((c) => ({
      id: c.id,
      file: `chunks/${c.id}.json`,
      url: c.url,
      path: c.path,
      section: c.section,
      title: c.title,
      heading: c.heading,
      parentHeadings: c.parentHeadings,
      tokenEstimate: c.tokenEstimate,
      chunkIndex: c.chunkIndex,
      totalChunks: c.totalChunks,
    })),
  };

  writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));

  // Summary
  console.log("=== Done! ===\n");
  console.log(`  Pages crawled:      ${pages.length}`);
  console.log(`  Chunks generated:   ${chunks.length}`);
  console.log(`  Est. total tokens:  ${totalTokenEstimate.toLocaleString()}`);
  console.log(`  Sections:           ${sections.join(", ")}`);
  console.log(`\n  Output: ${OUTPUT_DIR}/`);
  console.log(`  Manifest: ${MANIFEST_FILE}`);
  console.log(`  Chunks: ${CHUNKS_DIR}/`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
