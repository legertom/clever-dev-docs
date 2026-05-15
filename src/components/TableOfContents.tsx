"use client";

import { useEffect, useState } from "react";

export interface TocItem {
  id: string;
  label: string;
}

interface TableOfContentsProps {
  items: TocItem[];
}

export default function TableOfContents({ items }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    const sections = items
      .map(({ id }) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    // The About page scrolls inside a `flex-1 overflow-y-auto` wrapper, not the
    // window. IntersectionObserver needs that element as its root to fire.
    const findScrollRoot = (el: HTMLElement): HTMLElement | null => {
      let parent: HTMLElement | null = el.parentElement;
      while (parent) {
        const overflowY = getComputedStyle(parent).overflowY;
        if (overflowY === "auto" || overflowY === "scroll") return parent;
        parent = parent.parentElement;
      }
      return null;
    };

    const scrollRoot = findScrollRoot(sections[0]);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length === 0) return;
        const topmost = visible.reduce((closest, entry) =>
          entry.boundingClientRect.top < closest.boundingClientRect.top
            ? entry
            : closest,
        );
        setActiveId(topmost.target.id);
      },
      {
        root: scrollRoot,
        rootMargin: "-80px 0px -65% 0px",
        threshold: 0,
      },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav
      aria-label="On this page"
      className="sticky top-8 max-h-[calc(100vh-6rem)] overflow-y-auto pt-2"
    >
      <div className="text-[11px] uppercase tracking-[0.18em] text-clever-blue mb-4 font-semibold font-[family-name:var(--font-body)]">
        Sections
      </div>
      <ul className="border-l border-clever-light-blue">
        {items.map(({ id, label }, idx) => {
          const isActive = activeId === id;
          const num = idx.toString().padStart(2, "0");
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={isActive ? "location" : undefined}
                onClick={() => setActiveId(id)}
                className={`group flex items-center gap-4 py-2.5 pl-4 pr-2 -ml-px border-l-2 transition-colors font-[family-name:var(--font-body)] ${
                  isActive ? "border-clever-blue" : "border-transparent"
                }`}
              >
                <span
                  className={`text-sm tabular-nums shrink-0 ${
                    isActive ? "text-clever-blue font-medium" : "text-clever-blue/50"
                  }`}
                >
                  {num}
                </span>
                <span
                  className={`text-sm leading-snug flex-1 transition-colors ${
                    isActive
                      ? "text-clever-navy font-semibold"
                      : "text-clever-black/55 font-medium group-hover:text-clever-navy"
                  }`}
                >
                  {label}
                </span>
                <span
                  aria-hidden="true"
                  className={`shrink-0 inline-flex items-center justify-end h-3.5 w-6 rounded-full pr-[3px] transition-colors ${
                    isActive ? "bg-clever-blue/20" : "bg-clever-black/10"
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${
                      isActive ? "bg-clever-blue" : "bg-clever-black/35"
                    }`}
                  />
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
