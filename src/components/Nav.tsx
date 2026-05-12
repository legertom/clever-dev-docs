import Link from "next/link";

export default function Nav() {
  return (
    <header className="border-b border-clever-light-blue bg-white px-6 py-4 flex-shrink-0">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-clever-blue flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c3.87 0 7 3.13 7 7 0 1.93-.78 3.68-2.05 4.95l-1.41-1.41A5.014 5.014 0 0017 12c0-2.76-2.24-5-5-5v3L8 6l4-4v3z" fill="white" opacity="0.9"/>
              <path d="M12 22C6.48 22 2 17.52 2 12h3c0 3.87 3.13 7 7 7v-3l4 4-4 4v-3z" fill="white"/>
            </svg>
          </div>
          <div>
            <span className="text-lg font-bold text-clever-navy font-[family-name:var(--font-heading)] block">
              Clever Dev Docs
            </span>
            <span className="text-sm text-clever-black/60 font-[family-name:var(--font-body)] block">
              Library, Secure Sync, SSO, and APIs
            </span>
          </div>
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/about"
            className="text-sm font-medium text-clever-blue hover:text-clever-navy transition-colors"
          >
            About
          </Link>
          <Link
            href="/feedback"
            className="text-sm font-medium text-clever-blue hover:text-clever-navy transition-colors"
          >
            Feedback
          </Link>
          <Link
            href="/eval"
            className="text-sm font-medium text-clever-blue hover:text-clever-navy transition-colors"
          >
            Eval
          </Link>
        </nav>
      </div>
    </header>
  );
}
