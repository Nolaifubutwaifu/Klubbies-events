import Link from "next/link";
import type { ReactNode } from "react";
import { LegalContents } from "@/components/LegalContents";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";

export function supportEmail(): string | null {
  const value = process.env.SUPPORT_EMAIL?.trim();
  return value ? value : null;
}

export function ContactLine() {
  const email = supportEmail();
  return email ? (
    <>
      email <a href={`mailto:${email}`}>{email}</a>
    </>
  ) : (
    <>reply to your Stripe receipt</>
  );
}

export type LegalSection = { title: string; body: ReactNode };

const DOCS = [
  { key: "privacy", href: "/privacy", label: "Privacy" },
  { key: "terms", href: "/terms", label: "Terms" },
  { key: "refunds", href: "/refunds", label: "Refunds" },
] as const;

export function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Privacy, Terms and Refunds: the site's nav and footer, a sticky contents
 * list beside a 720px article, and a date under every title.
 */
export function LegalPage({
  doc,
  title,
  updated,
  minutes,
  sections,
}: {
  doc: (typeof DOCS)[number]["key"];
  title: string;
  updated: string;
  minutes: number;
  sections: LegalSection[];
}) {
  const items = sections.map((section) => ({ id: slug(section.title), title: section.title }));

  return (
    <div className="flex flex-1 flex-col">
      <SiteNav current="privacy" />
      <main className="kb-wrap flex-1 py-12 sm:py-16">
        <div className="grid items-start gap-10 lg:grid-cols-[280px_minmax(0,720px)] lg:gap-16">
          <aside className="lg:sticky lg:top-6">
            <nav aria-label="Legal documents" className="flex rounded-full bg-[color:var(--kb-sand)] p-1">
              {DOCS.map((d) => (
                <Link
                  key={d.key}
                  href={d.href}
                  aria-current={d.key === doc ? "page" : undefined}
                  className={`flex min-h-[44px] flex-1 items-center justify-center rounded-full text-[15px] font-bold no-underline ${
                    d.key === doc ? "bg-white text-[color:var(--kb-ink)] shadow-sm" : "text-[color:var(--kb-ink-2)]"
                  }`}
                >
                  {d.label}
                </Link>
              ))}
            </nav>
            <div className="mt-8 hidden lg:block">
              <LegalContents items={items} />
            </div>
          </aside>

          <article>
            <span className="soft-chip">Plain English</span>
            <h1 className="mt-4 font-[family-name:var(--kb-font-display)] text-[40px] font-bold leading-[1.05] sm:text-[56px]">{title}</h1>
            <p className="mt-3 text-[15px] text-[color:var(--kb-ink-3)]">
              Last updated {updated} · About {minutes} {minutes === 1 ? "minute" : "minutes"} to read
            </p>
            <div className="mt-10 flex flex-col gap-9">
              {sections.map((section) => (
                <section key={section.title} id={slug(section.title)} className="scroll-mt-6">
                  <h2 className="font-[family-name:var(--kb-font-display)] text-[26px] font-semibold leading-[1.2]">{section.title}</h2>
                  <div className="mt-3 flex flex-col gap-4 text-[17px] leading-[1.7] text-[#4e4449]">{section.body}</div>
                </section>
              ))}
            </div>
          </article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
