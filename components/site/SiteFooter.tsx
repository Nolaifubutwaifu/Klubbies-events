import Link from "next/link";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/signin", label: "Log in" },
      { href: "/start", label: "Start your club" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/refunds", label: "Refunds" },
    ],
  },
];

/** Placeholder until a support inbox exists. */
export const SUPPORT_EMAIL = "[SUPPORT EMAIL]";

/** One footer for every public page and the app. */
export function SiteFooter() {
  return (
    <footer className="border-t border-[color:var(--kb-line)] bg-[color:var(--kb-cream)]">
      <div className="kb-wrap grid grid-cols-2 gap-x-6 gap-y-10 py-14 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <span className="soft-wordmark text-[24px]">klubbies</span>
          <p className="mt-2 max-w-[26ch] text-[15px] text-[color:var(--kb-ink-2)]">Your club&rsquo;s photos, for your club only.</p>
        </div>
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h2 className="font-[family-name:var(--kb-font-body)] text-[14px] font-bold tracking-normal text-[color:var(--kb-ink)]">{column.title}</h2>
            <ul className="m-0 mt-2 flex list-none flex-col p-0">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="flex min-h-[44px] items-center text-[15px] text-[color:var(--kb-ink-2)] no-underline hover:text-[color:var(--kb-ink)] hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <h2 className="font-[family-name:var(--kb-font-body)] text-[14px] font-bold tracking-normal text-[color:var(--kb-ink)]">Contact</h2>
          <ul className="m-0 mt-2 flex list-none flex-col p-0 text-[15px] text-[color:var(--kb-ink-2)]">
            <li className="flex min-h-[44px] items-center">{SUPPORT_EMAIL}</li>
            <li>Club data stored in Sydney, Australia</li>
          </ul>
        </div>
      </div>
      <div className="kb-wrap">
        <p className="border-t border-[color:var(--kb-line)] py-6 text-[14px] text-[color:var(--kb-ink-3)]">&copy; 2026 Klubbies</p>
      </div>
    </footer>
  );
}
