---
name: clever-docs
description: Search and retrieve Clever developer documentation. Use when the user asks about Clever APIs, SSO, OAuth, OIDC, SAML, rostering, Secure Sync, LMS Connect, data model, districts, schools, sections, users, events, certifications, or any Clever integration topic.
allowed-tools: Read, Grep, Glob, Bash
argument-hint: "[search query]"
---

# Clever Dev Docs Search

You have access to a chunked, indexed copy of the Clever developer documentation at `docs/`.

## How to use

1. **Read the manifest** at `docs/manifest.json` to understand what's available. The manifest contains an index of all chunks with their `id`, `section`, `title`, `heading`, `parentHeadings`, and `tokenEstimate`.

2. **Find relevant chunks** by:
   - Scanning the manifest's `chunks` array for matching `title`, `heading`, or `section` fields
   - Using `Grep` to search chunk content: `grep -r "search term" docs/chunks/`
   - Filtering by section (e.g., "Clever SSO", "OAuth and OIDC", "APIs & Data Model")

3. **Load specific chunks** by reading `docs/chunks/<id>.json`. Each chunk contains:
   - `content`: The actual documentation text in markdown
   - `url`: Source URL on dev.clever.com for citation
   - `section`: Which docs section this belongs to
   - `title`: Page title
   - `heading`: Specific heading within the page
   - `parentHeadings`: Breadcrumb trail of headings
   - `tokenEstimate`: Approximate token count

4. **Answer the user's question** using the loaded chunk content. Always cite the source URL.

## Search strategy

The user's query is: $ARGUMENTS

If no query was provided, ask the user what they want to know about Clever.

Follow this search strategy:
1. First read `docs/manifest.json` and scan for chunks whose title/heading/section match the query
2. If no obvious match, use Grep to search chunk content for relevant keywords
3. Load the most relevant chunks (usually 2-5 chunks is enough)
4. Synthesize an answer from the chunk content
5. Always include source URLs so the user can read the full docs

## Important

- Always cite source URLs from the chunk metadata
- If the docs don't cover the topic, say so and suggest checking dev.clever.com directly
- The docs were last crawled on the date shown in `manifest.json`'s `generatedAt` field
- If chunks seem outdated, suggest running `bun run crawl` to refresh
