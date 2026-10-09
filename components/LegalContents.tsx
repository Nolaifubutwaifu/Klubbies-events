"use client";

import { useEffect, useState } from "react";

/** "On this page": every h2, with the one you're reading highlighted. */
export function LegalContents({ items }: { items: { id: string; title: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);

  // The section you're reading is the last one whose heading has passed the
  // top third of the window, or the last one once you reach the bottom. The
  // old observer only saw headings inside a thin band, so on long sections
  // the highlight stayed behind.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.33;
      let current = items[0]?.id;
      for (const item of items) {
        const node = document.getElementById(item.id);
        if (node && node.getBoundingClientRect().top <= line) current = item.id;
      }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) current = items[items.length - 1]?.id;
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
  }, [items]);

  return (
    <nav aria-label="On this page">
      <span className="text-[14px] font-bold text-[color:var(--kb-ink)]">On this page</span>
      <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? "location" : undefined}
              className={`flex min-h-[40px] items-center rounded-[12px] px-3 text-[15px] leading-[1.3] no-underline ${
                active === item.id
                  ? "bg-[color:var(--kb-ember-tint)] font-bold text-[color:var(--kb-ember-deep)]"
                  : "text-[color:var(--kb-ink-2)] hover:text-[color:var(--kb-ink)]"
              }`}
            >
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
