"use client";

import { useEffect, useState } from "react";

/** "On this page": every h2, with the one you're reading highlighted. */
export function LegalContents({ items }: { items: { id: string; title: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "0px 0px -70% 0px" },
    );
    for (const item of items) {
      const node = document.getElementById(item.id);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
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
