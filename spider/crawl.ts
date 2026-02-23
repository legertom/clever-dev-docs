import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { BASE_URL, CONCURRENCY, REQUEST_DELAY_MS } from "./config.ts";

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
}

/**
 * Fetch a single doc page and extract its content as markdown.
 */
export async function crawlPage(
  path: string,
  section: string
): Promise<CrawlResult | null> {
  const url = `${BASE_URL}${path}`;

  try {
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

    // ReadMe docs: the main content is typically in a specific container
    // Try several selectors that ReadMe uses
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
      $("nav, header, footer, script, style, [class*='sidebar'], [class*='nav']").remove();
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
    };
  } catch (err) {
    console.error(`  [ERROR] ${url}: ${err}`);
    return null;
  }
}

/**
 * Crawl all pages with concurrency control.
 */
export async function crawlAll(
  pages: Array<{ path: string; section: string }>
): Promise<CrawlResult[]> {
  const results: CrawlResult[] = [];
  const visited = new Set<string>();
  const queue = [...pages];

  let activeCount = 0;

  async function processNext(): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item || visited.has(item.path)) continue;
      visited.add(item.path);

      // Rate limiting
      await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));

      console.log(`  Crawling: ${item.path}`);
      const result = await crawlPage(item.path, item.section);

      if (result) {
        results.push(result);

        // Add discovered pages we haven't seen
        for (const discovered of result.discoveredPaths) {
          if (!visited.has(discovered) && !queue.some((q) => q.path === discovered)) {
            queue.push({ path: discovered, section: "Discovered" });
          }
        }
      }
    }
  }

  // Run workers up to CONCURRENCY limit
  const workers: Promise<void>[] = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(processNext());
  }
  await Promise.all(workers);

  return results;
}
