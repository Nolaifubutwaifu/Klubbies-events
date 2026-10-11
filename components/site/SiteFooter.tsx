import Link from "next/link";
import { Brand } from "@/components/ui";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/support", label: "Support" },
      { href: "/support#contact", label: "Contact us" },
      { href: "/signin", label: "Sign in" },
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

/** One footer for every public page, on night. */
export function SiteFooter({ inApp = false }: { inApp?: boolean }) {
  // No pricing inside the iPhone app (Apple allows no payment prompts there).
  const columns = inApp
    ? COLUMNS.map((column) => ({ ...column, links: column.links.filter((link) => link.href !== "/pricing") }))
    : COLUMNS;
  return (
    <footer className="bg-[color:var(--kb-night)] text-white">
      <div className="kb-wrap flex flex-col gap-14 pb-10 pt-[72px]">
        <div className="flex flex-wrap gap-10">
          <div className="flex max-w-[420px] flex-[2_1_320px] flex-col gap-4">
            <Brand size={18} tone="light" />
            <p className="text-[15px] text-[color:var(--kb-night-ink)]">Private photo galleries for corporate events and meetups.</p>
          </div>
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title} className="flex flex-[1_1_160px] flex-col gap-1">
              <h2 className="pb-1 text-[14px] font-semibold text-white">{column.title}</h2>
              {column.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex min-h-[36px] items-center text-[15px] text-[color:var(--kb-night-ink)] no-underline hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div className="flex flex-wrap justify-between gap-3 border-t border-[color:var(--kb-night-line)] pt-6 text-[14px] text-[color:var(--kb-night-ink)]">
          <span>&copy; 2026 Klubbies Events</span>
          <span>Data stored in Sydney, Australia</span>
        </div>
      </div>
    </footer>
  );
}
