/**
 * Doc ingestion pipeline: scrape → chunk → embed → store
 *
 * Usage: pnpm ingest
 *
 * Required env vars (see .env.local.example):
 *   - AI_GATEWAY_API_KEY      (or run via `vercel env pull` for OIDC token)
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Re-running this script wipes existing chunks and re-ingests from
 * scratch. For production you'd want incremental updates: hash each
 * chunk's content and only re-embed changed chunks.
 */

import { load } from "cheerio";
import { createClient } from "@supabase/supabase-js";
import { gateway } from "@ai-sdk/gateway";
import { embedMany } from "ai";

// ── Configuration ────────────────────────────────────────────

const BASE_URL = "https://dev.clever.com";

// Comprehensive corpus: every public docs page from dev.clever.com,
// derived from the official sitemap.xml.
//
// Earlier versions of this script were scoped to a "Library + SSO +
// API basics" subset. We expanded to the full corpus because:
//   1. Semantic search doesn't punish unrelated chunks — they just
//      score low and get filtered. So broader corpus ≠ noisier results.
//   2. A more useful product. An assistant that can answer LMS Connect
//      or Secure Sync informational questions (even if the user can't
//      self-serve those paths) is more valuable than one that declines.
//   3. The "audience routing" concern is now handled in the system
//      prompt instead of by exclusion: when a question topic suggests
//      a path that requires an Application Success Manager (Secure
//      Sync, district-managed integrations), the model still answers
//      the documentation question but explicitly notes the access
//      requirement and points the user to support.
//
// Sourced from https://dev.clever.com/sitemap.xml — refresh by
// re-fetching the sitemap if Clever publishes new pages.
const DOC_PATHS = [
  // ── Getting started / overview ─────────────────────────────
  "/docs/getting-started",
  "/docs/what-is-clever",
  "/docs/integration-types",
  "/docs/core-concepts",
  "/docs/onboarding",

  // ── Clever Library ────────────────────────────────────────
  "/docs/library-sso",
  "/docs/setting-up-library-sso-and-rostering",
  "/docs/clever-library-rostering",
  "/docs/clever-library-user-flow",
  "/docs/data-model-quirks-and-supported-features-classroom-integrations",
  "/docs/testing-library",
  "/docs/testing-clever-library-with-postman",
  "/docs/library-certification-guide",
  "/docs/clever-single-sign-on-vs-clever-library-sso-copy",

  // ── Single Sign-On (Library + District) ────────────────────
  "/docs/getting-started-with-clever-sso",
  "/docs/district-sso-vs-library-sso",
  "/docs/setting-up-district-sso",
  "/docs/oauth-implementation",
  "/docs/oidc-implementation",
  "/docs/migrating-to-oidc",
  "/docs/the-userinfo-endpoint",
  "/docs/example-oauth-walkthrough",
  "/docs/best-practices-edge-cases",
  "/docs/il-security",
  "/docs/multi-role-users-in-clever",
  "/docs/testing-your-sso-integration",
  "/docs/clever-sso-assets",
  "/docs/saml",
  "/docs/saml-overview",
  "/docs/saml-getting-started",
  "/docs/moodle-sso-integration-guide",

  // ── iOS-specific SSO ───────────────────────────────────────
  "/docs/ios",
  "/docs/ios-support",
  "/docs/il-native-ios",
  "/docs/liwc-ios-update",

  // ── Certification & Going Live ─────────────────────────────
  "/docs/certification-overview",
  "/docs/going-live",
  "/docs/library-certification-guide",
  "/docs/district-sso-certification-guide",
  "/docs/secure-sync-certification-guide",
  "/docs/clever-secure-sync-certification-guide-copy",

  // ── Secure Sync (district rostering) ───────────────────────
  "/docs/secure-sync-rostering",
  "/docs/anyschool-rostering",
  "/docs/anyschool-api-schema",
  "/docs/district-sso-1",
  "/docs/data-model-quirks-and-supported-features-district-integrations",
  "/docs/security",
  "/docs/ss-design",
  "/docs/sync-testing",
  "/docs/sync-troubleshooting",
  "/docs/data-changes",
  "/docs/events-api",

  // ── LMS Connect ────────────────────────────────────────────
  "/docs/clever-lms-connect",
  "/docs/lms-connect-overview",
  "/docs/lms-connect-beginners-guide",
  "/docs/lms-connect-output-behavior",
  "/docs/lms-connect-lti-13-sso",
  "/docs/lti-13-sso-setup-and-end-user-behavior",
  "/docs/testing-your-lms-connect-integration",
  "/docs/clever-lms-connect-api-errors",
  "/docs/submitting-schoology-submissions",

  // ── Attendance Data ────────────────────────────────────────
  "/docs/attendance-data-overview",
  "/docs/attendance-data-pagination",
  "/docs/attendance-data-how-does-it-work",

  // ── API: overview, schema, FAQs ────────────────────────────
  "/docs/api-overview",
  "/docs/api-reference",
  "/docs/exploring-the-clever-api",
  "/docs/api-v3-faqs",
  "/docs/api-v3-upgrade-guide",
  "/docs/api-v31",
  "/docs/whats-new-in-api-v31",
  "/docs/new-in-api-v3",
  "/docs/clever-api-v31-data-schema",
  "/docs/error-messages",
  "/docs/paging-and-limits",
  "/docs/libraries",
  "/docs/resources",
  "/docs/extension-fields",
  "/docs/updating-to-use-tls-12-on-connection-to-clever-api",

  // ── Data Model (per-resource) ──────────────────────────────
  "/docs/data-model",
  "/docs/contacts-guardians",
  "/docs/courses",
  "/docs/districts",
  "/docs/schools",
  "/docs/sections",
  "/docs/terms",
  "/docs/users",
];

// Chunk target: 800-1200 chars. Developer docs have dense, structured
// content — too-small chunks lose context (e.g. a table split from its
// header), too-large chunks dilute retrieval precision.
const CHUNK_TARGET = 1000;
const CHUNK_OVERLAP = 200;

// ── Scraping ─────────────────────────────────────────────────

interface PageContent {
  url: string;
  title: string;
  content: string;
}

async function scrapePage(path: string): Promise<PageContent | null> {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  ✗ ${path} → ${res.status}`);
      return null;
    }
    const html = await res.text();
    const $ = load(html);

    // Remove nav, sidebar, footer, and script elements
    $(
      "nav, footer, script, style, .sidebar, .header, .rm-Header, .rm-Sidebar"
    ).remove();

    // Extract page title from the h1
    const title =
      $("h1").first().text().trim() || $("title").text().trim() || path;

    // Extract the main content area. ReadMe-based doc sites typically
    // use an article or .markdown-body wrapper.
    let content = "";
    const contentSelectors = [
      "article",
      ".markdown-body",
      '[class*="content"]',
      "main",
      ".rm-Article",
    ];

    for (const selector of contentSelectors) {
      const el = $(selector).first();
      if (el.length && el.text().trim().length > 200) {
        content = extractText($, el);
        break;
      }
    }

    // Fallback: grab body text
    if (!content) {
      content = extractText($, $("body"));
    }

    // Clean up excessive whitespace
    content = content.replace(/\n{3,}/g, "\n\n").trim();

    if (content.length < 100) {
      console.error(`  ✗ ${path} → too little content (${content.length} chars)`);
      return null;
    }

    console.log(`  ✓ ${path} → ${content.length} chars`);
    return { url, title, content };
  } catch (err) {
    console.error(`  ✗ ${path} → ${err}`);
    return null;
  }
}

function extractText(
  $: ReturnType<typeof load>,
  el: ReturnType<ReturnType<typeof load>>
): string {
  const lines: string[] = [];

  el.find("h1, h2, h3, h4, p, li, pre, code, td, th, blockquote").each(
    (_, elem) => {
      const tag = (elem as unknown as { tagName: string }).tagName;
      const text = $(elem).text().trim();
      if (!text) return;

      if (tag.startsWith("h")) {
        const level = parseInt(tag[1]);
        lines.push(`\n${"#".repeat(level)} ${text}\n`);
      } else if (tag === "li") {
        lines.push(`• ${text}`);
      } else if (tag === "pre" || tag === "code") {
        if (text.length > 10) {
          lines.push(`\`\`\`\n${text}\n\`\`\``);
        }
      } else {
        lines.push(text);
      }
    }
  );

  return lines.join("\n");
}

// ── Chunking ─────────────────────────────────────────────────

interface Chunk {
  content: string;
  url: string;
  title: string;
  chunkIndex: number;
}

function chunkContent(page: PageContent): Chunk[] {
  const sections = page.content.split(/\n(?=#{1,3} )/);
  const chunks: Chunk[] = [];
  let currentChunk = "";
  let chunkIndex = 0;

  for (const section of sections) {
    // If adding this section would exceed target, flush the current chunk
    if (
      currentChunk.length > 0 &&
      currentChunk.length + section.length > CHUNK_TARGET
    ) {
      chunks.push({
        content: currentChunk.trim(),
        url: page.url,
        title: page.title,
        chunkIndex: chunkIndex++,
      });

      // Carry over the last CHUNK_OVERLAP chars for continuity.
      // This ensures questions about concepts that span section
      // boundaries still retrieve relevant context.
      const overlap = currentChunk.slice(-CHUNK_OVERLAP);
      currentChunk = overlap + "\n\n" + section;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + section;
    }
  }

  // Flush remaining
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      url: page.url,
      title: page.title,
      chunkIndex: chunkIndex,
    });
  }

  // Split any oversized chunks on paragraph boundaries
  const result: Chunk[] = [];
  for (const chunk of chunks) {
    if (chunk.content.length > CHUNK_TARGET * 1.5) {
      const subChunks = splitLargeChunk(chunk);
      result.push(...subChunks);
    } else {
      result.push(chunk);
    }
  }

  return result;
}

function splitLargeChunk(chunk: Chunk): Chunk[] {
  const paragraphs = chunk.content.split(/\n\n+/);
  const result: Chunk[] = [];
  let current = "";
  let idx = 0;

  for (const para of paragraphs) {
    if (current.length + para.length > CHUNK_TARGET && current.length > 200) {
      result.push({
        content: current.trim(),
        url: chunk.url,
        title: chunk.title,
        chunkIndex: chunk.chunkIndex * 100 + idx++,
      });
      const overlap = current.slice(-CHUNK_OVERLAP);
      current = overlap + "\n\n" + para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }

  if (current.trim()) {
    result.push({
      content: current.trim(),
      url: chunk.url,
      title: chunk.title,
      chunkIndex: chunk.chunkIndex * 100 + idx,
    });
  }

  return result;
}

// ── Embedding & Storage ──────────────────────────────────────

async function embedAndStore(chunks: Chunk[]): Promise<void> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Clear existing documents for a clean re-ingest.
  // In production, you'd do incremental updates with content hashing
  // to avoid re-embedding unchanged chunks.
  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .neq("id", 0);
  if (deleteError) {
    console.error("Warning: could not clear existing documents:", deleteError);
  }

  // Batch embed in groups of 100 (OpenAI limit for embedMany)
  const batchSize = 100;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    console.log(
      `  Embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} (${batch.length} chunks)...`
    );

    // Embeddings via the Vercel AI Gateway. Same dimensions (1536) and
    // cost as direct OpenAI, but routed through the gateway so we get
    // unified observability and a single auth mechanism with the chat
    // and eval routes.
    const { embeddings } = await embedMany({
      model: gateway.textEmbeddingModel("openai/text-embedding-3-small"),
      values: batch.map((c) => c.content),
    });

    const rows = batch.map((chunk, j) => ({
      // Strip unpaired UTF-16 surrogates. Some scraped pages contain
      // malformed Unicode (typically broken emoji sequences or stray
      // bytes) that the Postgres JSONB serializer rejects with
      // "Unicode low surrogate must follow a high surrogate". Stripping
      // them is safe — well-formed text is unaffected, and lone
      // surrogates carry no displayable meaning.
      content: chunk.content.replace(/[\uD800-\uDFFF]/g, ""),
      url: chunk.url,
      title: chunk.title,
      chunk_index: chunk.chunkIndex,
      embedding: JSON.stringify(embeddings[j]),
    }));

    const { error } = await supabase.from("documents").insert(rows);
    if (error) {
      console.error(`  ✗ Failed to insert batch:`, error);
      throw error;
    }
  }
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log(`\n📄 Scraping ${DOC_PATHS.length} pages from dev.clever.com...\n`);

  const pages: PageContent[] = [];
  for (const path of DOC_PATHS) {
    // Sequential to be polite to the server — no need to hammer it
    const page = await scrapePage(path);
    if (page) pages.push(page);
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n✂️  Chunking ${pages.length} pages...\n`);
  const allChunks: Chunk[] = [];
  for (const page of pages) {
    const chunks = chunkContent(page);
    console.log(`  ${page.title}: ${chunks.length} chunks`);
    allChunks.push(...chunks);
  }

  console.log(`\n📦 Total: ${allChunks.length} chunks\n`);
  console.log(
    `   Avg chunk size: ${Math.round(allChunks.reduce((s, c) => s + c.content.length, 0) / allChunks.length)} chars`
  );

  console.log(`\n🔢 Embedding and storing...\n`);
  await embedAndStore(allChunks);

  console.log(`\n✅ Done! ${allChunks.length} chunks ingested.\n`);
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
