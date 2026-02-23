---
name: crawl
description: Re-crawl the Clever developer documentation to refresh the local docs cache. Use when the user wants to update or refresh the docs.
disable-model-invocation: true
allowed-tools: Bash, Read
---

# Re-crawl Clever Dev Docs

Run the spider to refresh the local documentation cache from dev.clever.com.

## Steps

1. Run the crawl:
   ```
   bun run crawl
   ```
   Note: If `bun` is not on PATH, use `$HOME/.bun/bin/bun run crawl`

2. After crawl completes, report:
   - Number of pages crawled
   - Number of chunks generated
   - Total estimated tokens
   - How many pages needed Playwright fallback
   - Any pages that returned 404 errors

3. If the user wants to commit the updated docs, stage and commit them:
   ```
   git add docs/
   git commit -m "chore: update Clever dev docs $(date -u +%Y-%m-%d)"
   ```

## Dry run

If $ARGUMENTS contains "dry" or "--dry-run", run in dry-run mode instead:
```
bun run crawl:dry
```
This lists all pages that would be crawled without actually fetching them.
