"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

const transport = new DefaultChatTransport({ api: "/api/chat" });

// Pull the joined text from a message's parts array.
function messageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

const SUGGESTED_QUESTIONS = [
  "Is Clever Library free to build on?",
  "How do I set up SSO with Clever?",
  "What data fields are available for students?",
  "How long does Library certification take?",
];

export default function Home() {
  const { messages, sendMessage, setMessages, status } = useChat({ transport });
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  }

  function handleSuggestion(q: string) {
    if (isLoading) return;
    sendMessage({ text: q });
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
              C
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Clever Dev Docs Assistant
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Ask questions about Clever Library, SSO, APIs, and certification
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 whitespace-nowrap transition-colors"
                aria-label="Start a new conversation"
              >
                New chat
              </button>
            )}
            <a
              href="/about"
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              About
            </a>
            <a
              href="/feedback"
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              Feedback
            </a>
            <a
              href="/eval"
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              Eval
            </a>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                How can I help with your Clever integration?
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-md mx-auto">
                I can answer questions about Clever Library, SSO setup,
                certification requirements, and the Clever API — all grounded in
                the official developer docs.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSuggestion(q)}
                    className="px-4 py-2 text-sm rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, idx) => {
            // For assistant messages, find the user message that
            // immediately preceded it — that's the query that produced
            // this answer, included in any flag-for-review submission.
            const precedingQuery =
              message.role === "assistant"
                ? messageText(
                    [...messages.slice(0, idx)]
                      .reverse()
                      .find((m) => m.role === "user") ?? ({ parts: [] } as unknown as UIMessage)
                  )
                : "";

            return (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-5 py-3 ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  }`}
                >
                  {message.parts.map((part, i) => {
                    if (part.type === "text") {
                      return (
                        <div
                          key={i}
                          className="prose prose-sm dark:prose-invert max-w-none [&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:underline"
                        >
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkBreaks]}
                            components={{
                              a: ({ href, children }) => (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {children}
                                </a>
                              ),
                            }}
                          >
                            {part.text}
                          </ReactMarkdown>
                        </div>
                      );
                    }
                    return null;
                  })}

                  {message.role === "assistant" && (
                    <FlagForReview
                      messageId={message.id}
                      query={precedingQuery}
                      response={messageText(message)}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {status === "submitted" && (
            <div className="flex justify-start">
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-5 py-3">
                <div className="flex items-center gap-2 text-zinc-500">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" />
                  </div>
                  <span className="text-sm">Searching docs...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-4 flex-shrink-0">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about Clever Library, SSO, certification..."
            disabled={isLoading}
            className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-3 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-xl bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
        <p className="max-w-3xl mx-auto mt-2 text-xs text-zinc-400 text-center">
          Answers are generated from dev.clever.com docs. Always verify
          critical details in the official documentation.
        </p>
      </footer>
    </div>
  );
}

// ── Flag for review ────────────────────────────────────────────
// Lets the user flag an answer for human review. Submits to /api/feedback,
// where the row joins the same queue that low-confidence retrieval logs
// feed into. The UX is intentionally low-friction:
//   - Single tap on the icon button opens an inline form
//   - Note is optional — the query+response pair alone is useful signal
//   - On submit, the form collapses to a confirmation
// Keeping it inline (not modal) means the user doesn't lose their place
// in the conversation.
function FlagForReview({
  messageId,
  query,
  response,
}: {
  messageId: string;
  query: string;
  response: string;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500">
        ✓ Flagged for review — thanks. The support team will see this.
      </div>
    );
  }

  if (!open) {
    return (
      <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-end">
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 inline-flex items-center gap-1"
          aria-label="Flag this response for human review"
        >
          🚩 Flag for review
        </button>
      </div>
    );
  }

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, response, user_note: note }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubmitted(true);
    } catch (err) {
      console.error("Flag submit failed", err);
      alert("Failed to submit flag. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 space-y-2">
      <p className="text-xs text-zinc-500">
        What was wrong with this response? (optional)
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. answered the wrong question, missing a key detail, gave wrong API field name…"
        maxLength={1000}
        disabled={submitting}
        className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        rows={2}
      />
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => {
            setOpen(false);
            setNote("");
          }}
          disabled={submitting}
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-2 py-1"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={submitting}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-1.5 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </div>
      <p className="text-[10px] text-zinc-400">
        We&apos;ll include the question and the response automatically. id:{" "}
        <span className="font-mono">{messageId.slice(0, 8)}</span>
      </p>
    </div>
  );
}
