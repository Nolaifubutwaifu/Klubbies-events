import Link from "next/link";
import { Brand } from "@/components/ui";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/#how", label: "How it works" },
      { href: "/features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/faq", label: "FAQ" },
      { href: "/signin", label: "Sign in" },
      { href: "/start", label: "Create an event" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/refunds", label: "Refunds" },
      { href: "/support", label: "Support" },
    ],
  },
];

/** One footer for every public page. */
export function SiteFooter({ inApp = false }: { inApp?: boolean }) {
  const support = process.env.SUPPORT_EMAIL;
  // No pricing inside the iPhone app (Apple allows no payment prompts there).
  const columns = inApp
    ? COLUMNS.map((column) => ({ ...column, links: column.links.filter((link) => link.href !== "/pricing") }))
    : COLUMNS;
  return (
    <footer className="border-t border-[color:var(--kb-line)] bg-[color:var(--kb-white)]">
      <div className="kb-wrap grid grid-cols-2 gap-x-6 gap-y-10 py-14 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <Brand />
          <p className="mt-3 max-w-[28ch] text-[14px] text-[color:var(--kb-ink-2)]">Private photo galleries for corporate events and meetups.</p>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <h2 className="text-[14px] font-semibold text-[color:var(--kb-ink)]">{column.title}</h2>
            <ul className="m-0 mt-2 flex list-none flex-col p-0">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="flex min-h-[40px] items-center text-[14px] text-[color:var(--kb-ink-2)] no-underline hover:text-[color:var(--kb-ink)]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <h2 className="text-[14px] font-semibold text-[color:var(--kb-ink)]">Contact</h2>
          <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0 pt-2.5 text-[14px] text-[color:var(--kb-ink-2)]">
            {support ? (
              <li>
                <a href={`mailto:${support}`} className="text-[color:var(--kb-ink-2)]">
                  {support}
                </a>
              </li>
            ) : null}
            <li>Data stored in Sydney, Australia</li>
          </ul>
        </div>
      </div>
      <div className="kb-wrap">
        <p className="m-0 border-t border-[color:var(--kb-line)] py-6 text-[14px] text-[color:var(--kb-ink-3)]">&copy; 2026 Klubbies Events</p>
      </div>
    </footer>
  );
}
