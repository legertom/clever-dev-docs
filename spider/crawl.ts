import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { chromium, type Browser } from "playwright";
import {
  BASE_URL,
  CONCURRENCY,
  REQUEST_DELAY_MS,
  THIN_PAGE_THRESHOLD,
} from "./config.ts";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

// Preserve code blocks with language hints
turndown.addRule("fencedCodeBlock", {
  filter: (node) =>
    node.nodeName === "PRE" && !!node.querySelector("code"),
  replacement: (_content, node) => {
    const code = (node as HTMLElement).querySelector("code");
    if (!code) return _content;
    const lang =
      code.className?.match(/language-(\w+)/)?.[1] ??
      code.getAttribute("data-lang") ??
      "";
    const text = code.textContent ?? "";
    return `\n\n\`\`\`${lang}\n${text.trimEnd()}\n\`\`\`\n\n`;
  },
});

export interface CrawlResult {
  url: string;
  path: string;
  section: string;
  title: string;
  description: string;
  markdown: string;
  discoveredPaths: string[];
  crawledAt: string;
  fetchMethod: "static" | "playwright";
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Extract content from HTML string using cheerio + turndown.
 * Shared between static and Playwright paths.
 */
function extractFromHtml(
  html: string,
  url: string,
  path: string,
  section: string,
  fetchMethod: "static" | "playwright"
): CrawlResult {
  const $ = cheerio.load(html);

  // Extract page title
  const title =
    $("h1").first().text().trim() ||
    $("title").text().replace(/ \|.*$/, "").trim() ||
    path.split("/").pop() ||
    "";

  // Extract meta description
  const description =
    $('meta[name="description"]').attr("content") ??
    $('meta[property="og:description"]').attr("content") ??
    "";

  // ReadMe docs: try several selectors for the main content
  const contentSelectors = [
    '[class*="markdown-body"]',
    '[class*="content-body"]',
    "article",
    ".rm-Article",
    '[id="content"]',
    "main",
    ".content",
  ];

  let contentHtml = "";
  for (const selector of contentSelectors) {
    const el = $(selector).first();
    if (el.length && el.html()) {
      contentHtml = el.html()!;
      break;
    }
  }

  // Fallback: grab the whole body but strip nav/header/footer
  if (!contentHtml) {
    $(
      "nav, header, footer, script, style, [class*='sidebar'], [class*='nav']"
    ).remove();
    contentHtml = $("body").html() ?? "";
  }

  // Remove interactive elements that don't translate to docs
  const $content = cheerio.load(contentHtml);
  $content("button, [class*='try-it'], [class*='playground']").remove();

  const markdown = turndown.turndown($content.html() ?? "").trim();

  // Discover other /docs/ links on this page
  const discoveredPaths: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if (href.startsWith("/docs/") && !href.includes("#")) {
      const clean = href.split("?")[0];
      if (!discoveredPaths.includes(clean)) {
        discoveredPaths.push(clean);
      }
    }
  });

  return {
    url,
    path,
    section,
    title,
    description,
    markdown,
    discoveredPaths,
    crawledAt: new Date().toISOString(),
    fetchMethod,
  };
}

/**
 * Fast static fetch of a page (no JS rendering).
 */
async function fetchStatic(
  path: string,
  section: string
): Promise<CrawlResult | null> {
  const url = `${BASE_URL}${path}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "CleverDocSpider/1.0 (documentation indexer; contact: dev@example.com)",
      Accept: "text/html",
    },
  });

  if (!res.ok) {
    console.error(`  [${res.status}] ${url}`);
    return null;
  }

  const html = await res.text();
  return extractFromHtml(html, url, path, section, "static");
}

/**
 * Playwright-based fetch that waits for JS to render content.
 */
async function fetchWithPlaywright(
  browser: Browser,
  path: string,
  section: string
): Promise<CrawlResult | null> {
  const url = `${BASE_URL}${path}`;
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    // Extra wait for any lazy-loaded content
    await page.waitForTimeout(2000);

    const html = await page.content();
    return extractFromHtml(html, url, path, section, "playwright");
  } catch (err) {
    console.error(`  [PW ERROR] ${url}: ${err}`);
    return null;
  } finally {
    await page.close();
  }
}

/**
 * Crawl a single page: try static first, fall back to Playwright if thin.
 */
async function crawlPage(
  path: string,
  section: string,
  browser: Browser
): Promise<CrawlResult | null> {
  try {
    const result = await fetchStatic(path, section);
    if (!result) return null;

    const tokens = estimateTokens(result.markdown);
    if (tokens >= THIN_PAGE_THRESHOLD) {
      return result;
    }

    // Thin page - try Playwright
    console.log(`    -> thin (${tokens} tokens), retrying with Playwright...`);
    const pwResult = await fetchWithPlaywright(browser, path, section);
    if (pwResult && estimateTokens(pwResult.markdown) > tokens) {
      return pwResult;
    }

    // Playwright didn't help, return the static result
    return result;
  } catch (err) {
    console.error(`  [ERROR] ${BASE_URL}${path}: ${err}`);
    return null;
  }
}

/**
 * Crawl all pages with concurrency control and Playwright fallback.
 */
export async function crawlAll(
  pages: Array<{ path: string; section: string }>
): Promise<CrawlResult[]> {
  const browser = await chromium.launch({ headless: true });
  console.log("  Browser launched for JS-rendered pages.\n");

  const results: CrawlResult[] = [];
  const visited = new Set<string>();
  const queue = [...pages];

  async function processNext(): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item || visited.has(item.path)) continue;
      visited.add(item.path);

      await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));

      console.log(`  Crawling: ${item.path}`);
      const result = await crawlPage(item.path, item.section, browser);

      if (result) {
        results.push(result);

        for (const discovered of result.discoveredPaths) {
          if (
            !visited.has(discovered) &&
            !queue.some((q) => q.path === discovered)
          ) {
            queue.push({ path: discovered, section: "Discovered" });
          }
        }
      }
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(processNext());
  }
  await Promise.all(workers);

  await browser.close();

  // Report on fetch methods
  const pwCount = results.filter((r) => r.fetchMethod === "playwright").length;
  if (pwCount > 0) {
    console.log(
      `\n  ${pwCount} page(s) required Playwright for full content.`
    );
  }

  return results;
}
