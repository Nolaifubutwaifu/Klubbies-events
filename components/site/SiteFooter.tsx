import Link from "next/link";
import { Brand } from "@/components/ui";
import { INSTAGRAM_URL } from "@/lib/seo";

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
    title: "Use cases",
    links: [
      { href: "/christmas-parties", label: "Christmas parties" },
      { href: "/conferences", label: "Conferences" },
      { href: "/student-clubs", label: "Student clubs" },
      { href: "/photographers", label: "Photographers" },
      { href: "/brisbane", label: "Brisbane events" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/face-search-privacy", label: "Face search and privacy" },
      { href: "/guides", label: "Guides" },
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
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-[1.6fr_repeat(5,1fr)]">
          <div className="col-span-2 flex max-w-[420px] flex-col gap-4 sm:col-span-3 lg:col-span-1">
            <Brand size={18} tone="light" />
            <p className="text-[15px] text-[color:var(--kb-night-ink)]">Private event photo sharing with face search, for conferences, uni clubs and meetups.</p>
            <a
              href={INSTAGRAM_URL}
              rel="me noopener"
              aria-label="Klubbies Events on Instagram"
              target="_blank"
              className="flex min-h-[36px] items-center gap-2 self-start text-[15px] text-[color:var(--kb-night-ink)] no-underline hover:text-white"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
              </svg>
              @klubbies.events
            </a>
          </div>
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title} className="flex flex-col gap-1">
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
          <span>Based in Brisbane, QLD · Data stored in Sydney, Australia</span>
        </div>
      </div>
    </footer>
  );
}
