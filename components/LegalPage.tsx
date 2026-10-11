import Link from "next/link";
import type { ReactNode } from "react";
import { LegalContents } from "@/components/LegalContents";
import { PrintLink } from "@/components/PrintButton";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { supportEmail } from "@/lib/support";

export { supportEmail };

export function ContactLine() {
  const email = supportEmail();
  // The address itself stays off the site: scrapers harvest it for spam.
  return email ? (
    <>
      use the <Link href="/support#contact">contact form</Link>
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

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {icon}
      </svg>
      {children}
    </span>
  );
}

/**
 * Privacy, Terms and Refunds: a white title band with the three documents as
 * tabs, then a sticky numbered contents list beside the article.
 */
export async function LegalPage({
  doc,
  title,
  updated,
  minutes,
  summary,
  sections,
}: {
  doc: (typeof DOCS)[number]["key"];
  title: string;
  updated: string;
  minutes: number;
  /** One line "In short", in a blue box above the first section. */
  summary?: ReactNode;
  sections: LegalSection[];
}) {
  const items = sections.map((section) => ({ id: slug(section.title), title: section.title }));
  // Inside the iPhone app the nav and footer leave out Pricing and prices,
  // as everywhere else in the app (App Review guideline 3.1.1).
  const inApp = await isNativeAppRequest();

  return (
    <div className="flex flex-1 flex-col">
      <SiteNav current="privacy" inApp={inApp} />
      <main className="flex-1">
        <section className="border-b border-[color:var(--kb-line)] bg-white py-14 sm:pb-14 sm:pt-[72px]">
          <div className="kb-wrap flex flex-col gap-7">
            <nav aria-label="Legal documents" className="flex flex-wrap gap-1 self-start rounded-[10px] bg-[color:var(--kb-sand)] p-1">
              {DOCS.map((d) => (
                <Link
                  key={d.key}
                  href={d.href}
                  aria-current={d.key === doc ? "page" : undefined}
                  className={`flex min-h-[44px] items-center rounded-[8px] px-[18px] text-[15px] font-medium no-underline ${
                    d.key === doc ? "bg-white text-[color:var(--kb-ink)] shadow-[0_1px_2px_rgb(22_24_29/0.08)]" : "text-[color:var(--kb-ink-2)]"
                  }`}
                >
                  {d.label}
                </Link>
              ))}
            </nav>
            <h1 className="kb-h1 max-w-[16ch] !text-[68px] max-sm:!text-[46px]">{title}</h1>
            <div className="flex flex-wrap gap-x-7 gap-y-2 text-[15px] text-[color:var(--kb-ink-2)]">
              <Meta
                icon={
                  <>
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M3 10h18M8 3v4M16 3v4" />
                  </>
                }
              >
                Updated {updated}
              </Meta>
              <Meta
                icon={
                  <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </>
                }
              >
                {minutes} minute read
              </Meta>
              <PrintLink />
            </div>
          </div>
        </section>

        <section className="py-14 sm:pb-28">
          <div className="kb-wrap flex flex-wrap items-start gap-16">
            <aside className="hidden max-w-[300px] flex-[1_1_260px] lg:sticky lg:top-[104px] lg:block">
              <LegalContents items={items} />
            </aside>
            <article className="min-w-0 flex-[3_1_560px]">
              {summary ? (
                <div className="mb-6 flex gap-4 rounded-[12px] bg-[color:var(--kb-brand-tint)] px-7 py-6">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--kb-brand-deep)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 flex-none">
                    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
                  </svg>
                  <p className="text-[16px] text-[color:var(--kb-ink)]">{summary}</p>
                </div>
              ) : null}
              {sections.map((section, index) => (
                <section key={section.title} id={slug(section.title)} className="flex scroll-mt-24 flex-col gap-3 border-t border-[color:var(--kb-line)] py-8">
                  <h2 className="flex items-baseline gap-3.5 text-[22px] font-semibold tracking-[-0.01em]">
                    <span className="mono text-[15px] font-normal text-[color:var(--kb-brand)]">{String(index + 1).padStart(2, "0")}</span>
                    {section.title}
                  </h2>
                  <div className="flex max-w-[68ch] flex-col gap-4 text-[17px] leading-[1.7] text-[#33363d]">{section.body}</div>
                </section>
              ))}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-4 border-t border-[color:var(--kb-line)] pt-8">
                <span className="text-[color:var(--kb-ink-2)]">{doc === "privacy" ? "Questions about your data?" : "Questions about this policy?"}</span>
                <Link href="/support#contact" className="btn btn-secondary no-underline">
                  Use the contact form
                </Link>
              </div>
            </article>
          </div>
        </section>
      </main>
      <SiteFooter inApp={inApp} />
    </div>
  );
}
