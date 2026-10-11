export type FaqItem = { q: string; a: string };

/** The one FAQ accordion for the public pages. The first answer can start open. */
export function Faq({ items, openFirst = false }: { items: FaqItem[]; openFirst?: boolean }) {
  return (
    <div className="border-t border-[color:var(--kb-line-strong)]">
      {items.map((item, index) => (
        <details key={item.q} className="kb-faq" open={openFirst && index === 0}>
          <summary>{item.q}</summary>
          <p>{item.a}</p>
        </details>
      ))}
    </div>
  );
}
