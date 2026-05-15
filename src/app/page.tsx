"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

const transport = new DefaultChatTransport({ api: "/api/chat" });

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
  const [chatId, setChatId] = useState(() => crypto.randomUUID());
  const { messages, sendMessage, setMessages, status } = useChat({
    id: chatId,
    transport,
  });
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

  function resetChat() {
    setMessages([]);
    setChatId(crypto.randomUUID());
    setInput("");
  }

  function handleSuggestion(q: string) {
    if (isLoading) return;
    sendMessage({ text: q });
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={resetChat}
                className="inline-flex items-center gap-1.5 rounded-lg border border-clever-light-blue bg-white px-3 py-1.5 text-sm font-medium text-clever-navy hover:bg-clever-light-blue/50 transition-colors font-[family-name:var(--font-body)]"
                aria-label="Start a new conversation"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M13.5 8a5.5 5.5 0 0 1-9.27 4.01l-.03-.03" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M2.5 8a5.5 5.5 0 0 1 9.27-4.01l.03.03" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M2.5 12.5v-3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M13.5 3.5v3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                New chat
              </button>
            </div>
          )}
          {messages.length === 0 && (
            <div className="py-16 relative">
              {/* Decorative blobs */}
              <div className="absolute -top-4 -right-8 w-32 h-32 bg-clever-yellow/30 clever-blob-1 blur-sm" aria-hidden="true" />
              <div className="absolute bottom-8 -left-12 w-24 h-24 bg-clever-green/20 clever-blob-2 blur-sm" aria-hidden="true" />
              <div className="absolute top-24 right-16 w-16 h-16 bg-clever-orange/20 clever-blob-3 blur-sm" aria-hidden="true" />

              <div className="relative text-left max-w-lg">
                <h2 className="text-4xl font-normal text-clever-navy mb-4 font-[family-name:var(--font-heading)] leading-[0.95]">
                  How can I help with your Clever integration?
                </h2>
                <p className="text-clever-black/60 mb-8 leading-relaxed font-[family-name:var(--font-body)]">
                  I can answer questions about Clever Library, Secure Sync,
                  SSO, LMS Connect, certification, and the Clever API — all
                  grounded in the official developer docs.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSuggestion(q)}
                    className="px-4 py-2.5 text-sm rounded-xl border border-clever-light-blue text-clever-navy bg-clever-light-blue/30 hover:bg-clever-light-blue hover:border-clever-blue/20 transition-all duration-200 font-[family-name:var(--font-body)]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, idx) => {
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
                      ? "bg-clever-blue text-white"
                      : "bg-clever-light-blue/40 text-clever-black border border-clever-light-blue"
                  }`}
                >
                  {message.parts.map((part, i) => {
                    if (part.type === "text") {
                      return (
                        <div
                          key={i}
                          className={`prose prose-sm max-w-none [&_a]:underline font-[family-name:var(--font-body)] ${
                            message.role === "user"
                              ? "prose-invert [&_a]:text-white"
                              : "[&_a]:text-clever-blue"
                          }`}
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
              <div className="bg-clever-light-blue/40 border border-clever-light-blue rounded-2xl px-5 py-3">
                <div className="flex items-center gap-2 text-clever-blue">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-clever-blue/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-clever-blue/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-clever-blue/60 rounded-full animate-bounce" />
                  </div>
                  <span className="text-sm text-clever-black/60">Searching docs...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="border-t border-clever-light-blue bg-white px-6 py-4 flex-shrink-0">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about Library, Secure Sync, SSO, certification..."
            disabled={isLoading}
            className="flex-1 rounded-xl border border-clever-light-blue bg-white px-4 py-3 text-clever-black placeholder:text-clever-black/40 focus:outline-none focus:ring-2 focus:ring-clever-blue/40 focus:border-clever-blue disabled:opacity-50 font-[family-name:var(--font-body)]"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-xl bg-clever-blue px-6 py-3 text-white font-medium hover:bg-clever-navy disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-[family-name:var(--font-body)]"
          >
            Send
          </button>
        </form>
        <p className="max-w-3xl mx-auto mt-2 text-xs text-clever-black/40 text-center font-[family-name:var(--font-body)]">
          Answers are generated from dev.clever.com docs. Always verify
          critical details in the official documentation.
        </p>
      </footer>
    </div>
  );
}

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
      <div className="mt-3 pt-3 border-t border-clever-light-blue text-xs text-clever-black/50">
        Flagged for review — thanks. The support team will see this.
      </div>
    );
  }

  if (!open) {
    return (
      <div className="mt-3 pt-3 border-t border-clever-light-blue flex items-center justify-end">
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-clever-black/50 hover:text-clever-navy inline-flex items-center gap-1 transition-colors"
          aria-label="Flag this response for human review"
        >
          Flag for review
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
    <div className="mt-3 pt-3 border-t border-clever-light-blue space-y-2">
      <p className="text-xs text-clever-black/50">
        What was wrong with this response? (optional)
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. answered the wrong question, missing a key detail, gave wrong API field name..."
        maxLength={1000}
        disabled={submitting}
        className="w-full rounded-lg border border-clever-light-blue bg-white px-3 py-2 text-sm text-clever-black placeholder:text-clever-black/40 focus:outline-none focus:ring-2 focus:ring-clever-blue/40 disabled:opacity-50"
        rows={2}
      />
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => {
            setOpen(false);
            setNote("");
          }}
          disabled={submitting}
          className="text-xs text-clever-black/50 hover:text-clever-navy px-2 py-1 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={submitting}
          className="text-xs bg-clever-blue hover:bg-clever-navy text-white rounded-lg px-3 py-1.5 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Submitting..." : "Submit"}
        </button>
      </div>
      <p className="text-[10px] text-clever-black/40">
        We&apos;ll include the question and the response automatically. id:{" "}
        <span className="font-mono">{messageId.slice(0, 8)}</span>
      </p>
    </div>
  );
}
