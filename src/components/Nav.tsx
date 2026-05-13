import Image from "next/image";
import Link from "next/link";

export default function Nav() {
  return (
    <header className="border-b border-clever-light-blue bg-white px-6 py-4 flex-shrink-0">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/clever-wordmark.png"
            alt="Clever"
            width={128}
            height={34}
            priority
            className="h-7 w-auto"
          />
          <span
            aria-hidden="true"
            className="h-6 w-px bg-clever-light-blue"
          />
          <span className="text-sm text-clever-black/60 font-[family-name:var(--font-body)]">
            Dev Docs Assistant
          </span>
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
