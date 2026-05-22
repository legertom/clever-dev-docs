/**
 * Smoke test for the feedback pipeline.
 *
 * Why this exists: the /feedback page can go silent for two very different
 * reasons — (a) the write path is broken (Supabase creds rotated, schema
 * drifted, etc.), or (b) the triggering conditions just aren't being met
 * (no organic chat traffic, no queries fall below the confidence
 * threshold). This script forces both surfaced write paths to fire so we
 * can tell the two apart.
 *
 * It exercises:
 *   1. user_report  — POST /api/feedback with a marked payload
 *   2. low_confidence — POST /api/chat with a Clever-tagged query whose
 *      answer obviously isn't in the docs, so retrieval similarity stays
 *      below CONFIDENCE_THRESHOLD (0.6) and the chat route logs a row
 *
 * Run:
 *   pnpm test:feedback                                  # hits production
 *   FEEDBACK_TEST_URL=http://localhost:3000 pnpm test:feedback   # local dev
 *
 * After it runs, open /feedback and look for the marker string printed
 * at the end — both rows should be there.
 *
 * Cost: a few fractions of a cent in AI Gateway charges (one embedding +
 * one classifier call + one streamed completion).
 */

const BASE = (process.env.FEEDBACK_TEST_URL ?? "https://clever-dev-docs.vercel.app").replace(/\/$/, "");
const MARKER = `SMOKETEST-${new Date().toISOString().replace(/[:.]/g, "-")}`;

interface StepResult {
  ok: boolean;
  status: number;
  ms: number;
  snippet: string;
}

async function postJson(path: string, body: unknown): Promise<StepResult> {
  const url = `${BASE}${path}`;
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  // Drain the body — /api/feedback returns JSON, /api/chat returns a stream.
  // Either way we need to consume it before the connection is reused.
  const text = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    ms: Date.now() - t0,
    snippet: text.replace(/\s+/g, " ").slice(0, 140),
  };
}

async function step(label: string, fn: () => Promise<StepResult>): Promise<StepResult | null> {
  process.stdout.write(`  ${label} ... `);
  try {
    const r = await fn();
    const verdict = r.ok ? "PASS" : "FAIL";
    console.log(`${verdict}  (${r.status}, ${r.ms}ms)`);
    if (r.snippet) console.log(`         ${r.snippet}`);
    return r;
  } catch (err) {
    console.log(`FAIL  (${(err as Error).message})`);
    return null;
  }
}

async function main() {
  console.log(`Target:  ${BASE}`);
  console.log(`Marker:  ${MARKER}`);
  console.log("");

  console.log("1. user_report path  (POST /api/feedback)");
  const r1 = await step("submitting flagged answer", () =>
    postJson("/api/feedback", {
      query: `${MARKER} smoke-test query`,
      response: `${MARKER} pretend assistant response`,
      user_note: `${MARKER} automated smoke test — safe to delete`,
    })
  );

  // Brief pause so the per-IP rate limiter on /api/chat doesn't 429 us.
  await new Promise((r) => setTimeout(r, 1500));

  console.log("");
  console.log("2. low_confidence path  (POST /api/chat with on-topic + unanswerable query)");
  // The classifier needs to see this as on_topic (otherwise it gets
  // blocked as a guardrail and writes a guardrail row instead, which
  // /feedback doesn't display). Mentioning "Clever API" up front
  // keeps it on-topic. The rest of the query asks about an internal
  // implementation detail that no public docs page covers, so vector
  // similarity should stay below the 0.6 confidence threshold.
  const lowConfQ =
    `${MARKER} For the Clever API, what hash function does Clever use ` +
    `for internal tenant sharding and what's the exact replication lag SLA?`;
  const r2 = await step("sending on-topic + unanswerable chat query", () =>
    postJson("/api/chat", {
      messages: [
        {
          id: "smoketest-1",
          role: "user",
          parts: [{ type: "text", text: lowConfQ }],
        },
      ],
    })
  );

  console.log("");
  console.log("─".repeat(60));
  console.log("Next: open the feedback page and look for the marker.");
  console.log(`  ${BASE}/feedback`);
  console.log(`  marker:  ${MARKER}`);
  console.log("");
  console.log("Expected rows (within ~5 seconds of this script finishing):");
  console.log("  • 1 'User report' row — query/response/note all contain the marker");
  console.log("  • 1 'Low-confidence retrieval' row — query contains the marker");
  console.log("");

  const userReportOk = r1?.ok === true;
  const chatOk = r2?.ok === true;

  if (!userReportOk) {
    console.log("⚠  Step 1 did not return 200 — the /api/feedback endpoint itself");
    console.log("   is failing. Check the response body above for the error.");
  } else {
    console.log("If step 1 returned 200 but no 'User report' row appears:");
    console.log("  → write path is broken. Check Vercel function logs for:");
    console.log('     "[feedback] insert failed"');
    console.log('     "[feedback] background insert threw"');
    console.log("    Most likely: SUPABASE_SERVICE_ROLE_KEY rotated, or the");
    console.log("    feedback table schema drifted from src/lib/feedback.ts.");
  }
  console.log("");
  if (!chatOk) {
    console.log("⚠  Step 2 did not return 200 — /api/chat itself is failing,");
    console.log("   independent of the feedback pipeline.");
  } else {
    console.log("If step 2 returned 200 but no 'Low-confidence retrieval' row appears:");
    console.log("  → most likely the retriever's reported `similarity` is");
    console.log("    above the 0.6 confidence gate for this query.");
    console.log("    Under RETRIEVAL_MODE=hybrid (see src/lib/rag.ts), the");
    console.log("    SQL function intentionally inflates similarity for");
    console.log("    FTS-rescued chunks to pass that gate. If hybrid is on,");
    console.log("    organic low-confidence rows will be very rare — the");
    console.log("    plumbing is fine but the trigger condition has shifted.");
    console.log("    Check Vercel env: RETRIEVAL_MODE=hybrid vs vector.");
  }
}

main().catch((err) => {
  console.error("\nTest crashed:", err);
  process.exit(1);
});
