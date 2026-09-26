export type FaqItem = { q: string; a: string };

/** The one FAQ accordion, shared by Home and How it works. */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="border-t border-[color:var(--kb-line)]">
      {items.map((item) => (
        <details key={item.q} className="kb-faq">
          <summary>{item.q}</summary>
          <p>{item.a}</p>
        </details>
      ))}
    </div>
  );
}
