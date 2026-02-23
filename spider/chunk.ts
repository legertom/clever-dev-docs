import type { CrawlResult } from "./crawl.ts";
import { MAX_CHUNK_TOKENS, MIN_CHUNK_TOKENS } from "./config.ts";

export interface DocChunk {
  id: string;
  url: string;
  path: string;
  section: string;
  title: string;
  heading: string;
  headingLevel: number;
  parentHeadings: string[];
  content: string;
  tokenEstimate: number;
  crawledAt: string;
  chunkIndex: number;
  totalChunks: number;
}

/**
 * Rough token estimate: ~4 chars per token for English text.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Make a URL-safe slug from a string.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface Section {
  heading: string;
  headingLevel: number;
  content: string;
}

/**
 * Split markdown into sections by heading boundaries.
 */
function splitByHeadings(markdown: string): Section[] {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  let currentHeading = "";
  let currentLevel = 0;
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      // Save previous section
      if (currentLines.length > 0) {
        sections.push({
          heading: currentHeading,
          headingLevel: currentLevel,
          content: currentLines.join("\n").trim(),
        });
      }
      currentHeading = headingMatch[2].trim();
      currentLevel = headingMatch[1].length;
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  // Don't forget the last section
  if (currentLines.length > 0) {
    sections.push({
      heading: currentHeading,
      headingLevel: currentLevel,
      content: currentLines.join("\n").trim(),
    });
  }

  return sections;
}

/**
 * Merge small adjacent sections together so we don't have tiny useless chunks.
 */
function mergeSections(sections: Section[]): Section[] {
  const merged: Section[] = [];

  for (const section of sections) {
    const tokens = estimateTokens(section.content);

    if (
      merged.length > 0 &&
      tokens < MIN_CHUNK_TOKENS &&
      estimateTokens(merged[merged.length - 1].content) + tokens < MAX_CHUNK_TOKENS
    ) {
      // Merge into previous section
      merged[merged.length - 1].content += "\n\n" + section.content;
    } else {
      merged.push({ ...section });
    }
  }

  return merged;
}

/**
 * Split a single large section into smaller pieces if it exceeds MAX_CHUNK_TOKENS.
 * Splits on paragraph boundaries.
 */
function splitLargeSection(section: Section): Section[] {
  const tokens = estimateTokens(section.content);
  if (tokens <= MAX_CHUNK_TOKENS) return [section];

  const paragraphs = section.content.split(/\n\n+/);
  const result: Section[] = [];
  let currentParagraphs: string[] = [];
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    if (currentTokens + paraTokens > MAX_CHUNK_TOKENS && currentParagraphs.length > 0) {
      result.push({
        heading: section.heading,
        headingLevel: section.headingLevel,
        content: currentParagraphs.join("\n\n"),
      });
      currentParagraphs = [];
      currentTokens = 0;
    }

    currentParagraphs.push(para);
    currentTokens += paraTokens;
  }

  if (currentParagraphs.length > 0) {
    result.push({
      heading: section.heading,
      headingLevel: section.headingLevel,
      content: currentParagraphs.join("\n\n"),
    });
  }

  return result;
}

/**
 * Build the heading hierarchy (breadcrumb trail) for each section.
 */
function buildHeadingHierarchy(sections: Section[], pageTitle: string): string[][] {
  const hierarchies: string[][] = [];
  const stack: Array<{ heading: string; level: number }> = [];

  for (const section of sections) {
    // Pop stack entries that are at the same or deeper level
    while (stack.length > 0 && stack[stack.length - 1].level >= section.headingLevel) {
      stack.pop();
    }

    if (section.heading) {
      stack.push({ heading: section.heading, level: section.headingLevel });
    }

    const trail = [pageTitle, ...stack.map((s) => s.heading)];
    hierarchies.push(trail);
  }

  return hierarchies;
}

/**
 * Chunk a crawled page into AI-friendly pieces.
 */
export function chunkPage(page: CrawlResult): DocChunk[] {
  if (!page.markdown.trim()) return [];

  const slug = slugify(page.title || page.path.split("/").pop() || "unknown");

  // Split -> merge small -> split large
  let sections = splitByHeadings(page.markdown);
  sections = mergeSections(sections);
  sections = sections.flatMap(splitLargeSection);

  // Build heading hierarchies
  const hierarchies = buildHeadingHierarchy(sections, page.title);

  const totalChunks = sections.length;

  return sections.map((section, i) => ({
    id: `${slug}-${String(i).padStart(2, "0")}`,
    url: page.url,
    path: page.path,
    section: page.section,
    title: page.title,
    heading: section.heading || page.title,
    headingLevel: section.headingLevel,
    parentHeadings: hierarchies[i] || [page.title],
    content: section.content,
    tokenEstimate: estimateTokens(section.content),
    crawledAt: page.crawledAt,
    chunkIndex: i,
    totalChunks,
  }));
}

/**
 * Chunk all crawled pages.
 */
export function chunkAll(pages: CrawlResult[]): DocChunk[] {
  return pages.flatMap(chunkPage);
}
