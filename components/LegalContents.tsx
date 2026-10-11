"use client";

import { useEffect, useState } from "react";

/**
 * The section you're reading: the last one whose heading has passed the top
 * third of the window, or the last one once you reach the bottom. (An
 * observer that only saw headings inside a thin band left the highlight
 * behind on long sections.)
 */
export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  const key = ids.join(" ");

  useEffect(() => {
    const list = key.split(" ");
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.33;
      let current = list[0];
      for (const id of list) {
        const node = document.getElementById(id);
        if (node && node.getBoundingClientRect().top <= line) current = id;
      }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) current = list[list.length - 1];
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [key]);

  return active;
}

/** "On this page": every h2, numbered, with the one you're reading in blue. */
export function LegalContents({ items }: { items: { id: string; title: string }[] }) {
  const active = useActiveSection(items.map((item) => item.id));

  return (
    <nav aria-label="On this page" className="flex flex-col">
      <span className="pb-2 text-[14px] font-semibold text-[color:var(--kb-ink)]">On this page</span>
      {items.map((item, index) => {
        const current = active === item.id;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={current ? "location" : undefined}
            className={`flex gap-3 py-2 text-[15px] leading-[1.4] no-underline ${
              current ? "font-semibold text-[color:var(--kb-brand-deep)]" : "text-[color:var(--kb-ink-2)] hover:text-[color:var(--kb-ink)]"
            }`}
          >
            <span className={`mono flex-none ${current ? "text-[color:var(--kb-brand)]" : "text-[color:var(--kb-ink-3)]"}`}>
              {String(index + 1).padStart(2, "0")}
            </span>
            {item.title}
          </a>
        );
      })}
    </nav>
  );
}

/** The FAQ's topic list: one row per group with its count, the one you're reading tinted. */
export function TopicNav({ items }: { items: { id: string; title: string; count: number }[] }) {
  const active = useActiveSection(items.map((item) => item.id));

  return (
    <nav aria-label="Topics" className="flex flex-col gap-1">
      {items.map((item) => {
        const current = active === item.id;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={current ? "location" : undefined}
            className={`flex min-h-[44px] items-center justify-between rounded-[8px] px-3.5 text-[15px] font-medium no-underline ${
              current
                ? "bg-[color:var(--kb-brand-tint)] text-[color:var(--kb-brand-deep)]"
                : "text-[color:var(--kb-ink-2)] hover:bg-[color:var(--kb-sand)] hover:text-[color:var(--kb-ink)]"
            }`}
          >
            {item.title}
            <span className="mono text-[14px]">{item.count}</span>
          </a>
        );
      })}
    </nav>
  );
}
