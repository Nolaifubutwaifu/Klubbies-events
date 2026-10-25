import Link from "next/link";
import type { ReactNode } from "react";
import { Faq, type FaqItem } from "@/components/site/Faq";
import { NightCta, Photo } from "@/components/site/parts";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { JsonLd, SITE_NAME, SITE_URL } from "@/lib/seo";

/*
 * The template for the pages written to be found in search (SEO audit, 20 Oct
 * 2026, F18 to F20): use-case pages, /about, /brisbane and the guides. One
 * search intent per page, a few hundred words of plain copy, its own
 * questions, and links to the pages next to it. Callers leave prices out when
 * inApp is true, as everywhere else in the iPhone app.
 */

export type ContentSection = { title: string; body: ReactNode };
export type RelatedLink = { href: string; title: string; body: string };

/** A marketing photo with real alt text, for image search. */
export type ContentPhoto = { name: string; alt: string };

export function ContentPage({
  path,
  eyebrow,
  title,
  lead,
  photos,
  facts,
  sections,
  faqs = [],
  related,
  cta,
  article,
  inApp,
  wideTitle = false,
}: {
  path: string;
  eyebrow: ReactNode;
  title: ReactNode;
  lead: ReactNode;
  /** Up to four photos beside the heading. */
  photos?: ContentPhoto[];
  /** Short facts in a strip under the heading. */
  facts?: { label: string; title: string; body: string }[];
  sections: ContentSection[];
  faqs?: FaqItem[];
  related: RelatedLink[];
  cta: { title: string; lead: string; points: string[]; secondary: { href: string; label: string } };
  /** Guides: the headline and dates for Article markup. */
  article?: { headline: string; description: string; published: string; modified?: string };
  inApp: boolean;
  /**
   * Long search headings. The default 16ch cap is for short editorial titles;
   * these use the content column so they sit on two or three lines at desktop
   * size. Other pages keep the narrow measure.
   */
  wideTitle?: boolean;
}) {
  const faqPage = faqs.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
      }
    : null;
  const articleData = article
    ? {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: article.headline,
        description: article.description,
        datePublished: article.published,
        dateModified: article.modified ?? article.published,
        mainEntityOfPage: `${SITE_URL}${path}`,
        inLanguage: "en-AU",
        author: { "@type": "Organization", name: SITE_NAME, url: `${SITE_URL}/` },
        publisher: { "@id": `${SITE_URL}/#organization` },
      }
    : null;

  const titleClass = `kb-h1 !text-[68px] !leading-[1.02] max-sm:!text-[44px] ${wideTitle ? "max-w-[40ch] text-balance" : "max-w-[16ch]"}`;
  // Photos sit in a half column. A long title has to span the full content
  // width, or that column puts it back on four lines. The intro then starts
  // at the top of the photos instead of centering against them.
  const titleAbove = wideTitle && Boolean(photos?.length);
  const heading = (
    <>
      <span className="kb-eyebrow">{eyebrow}</span>
      <h1 className={titleClass}>{title}</h1>
    </>
  );

  return (
    <>
      {faqPage ? <JsonLd data={faqPage} /> : null}
      {articleData ? <JsonLd data={articleData} /> : null}
      <SiteNav inApp={inApp} />
      <main>
        <section className="pb-14 pt-12 sm:pb-20 sm:pt-24">
          <div className="kb-wrap flex flex-col gap-6">
            {titleAbove ? heading : null}
            <div className={`grid ${titleAbove ? "items-start lg:mt-4" : "items-center"} ${photos?.length ? "gap-14 lg:grid-cols-[1.1fr_1fr]" : ""}`}>
              <div className="flex flex-col gap-6">
                {titleAbove ? null : heading}
                <p className="kb-lead m-0 max-w-[56ch]">{lead}</p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/start" className="btn btn-primary btn-lg no-underline">
                    Create an event
                  </Link>
                  <Link href="/how-it-works" className="btn btn-secondary btn-lg no-underline">
                    How it works
                  </Link>
                </div>
              </div>
              {photos?.length ? (
                <div className="grid grid-cols-2 gap-2">
                  {photos.slice(0, 4).map((photo) => (
                    <Photo key={photo.name} name={photo.name} alt={photo.alt} className="aspect-square w-full rounded-[10px]" sizes="(max-width: 1024px) 50vw, 280px" />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {facts?.length ? (
          <section aria-label="At a glance" className="border-y border-[color:var(--kb-line)] bg-white">
            <div className="kb-wrap grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
              {facts.map((fact) => (
                <div key={fact.title} className="flex flex-col gap-1.5 border-t border-[color:var(--kb-line)] py-6 first:border-t-0 sm:border-t-0 sm:py-8">
                  <span className="mono text-[14px] text-[color:var(--kb-brand)]">{fact.label}</span>
                  <span className="text-[17px] font-semibold">{fact.title}</span>
                  <span className="text-[15px] text-[color:var(--kb-ink-2)]">{fact.body}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="py-14 sm:py-20">
          <div className="kb-wrap">
            <article className="mx-auto flex max-w-[720px] flex-col">
              {sections.map((section) => (
                <section key={section.title} className="flex flex-col gap-4 border-t border-[color:var(--kb-line)] py-9 first:border-t-0 first:pt-0">
                  <h2 className="text-[28px] font-semibold tracking-[-0.015em] max-sm:text-[24px]">{section.title}</h2>
                  <div className="flex flex-col gap-4 text-[17px] leading-[1.65] text-[color:var(--kb-ink-2)] [&_a:not(.btn)]:underline [&_a:not(.btn)]:underline-offset-4">
                    {section.body}
                  </div>
                </section>
              ))}
            </article>
          </div>
        </section>

        {faqs.length ? (
          <section className="border-t border-[color:var(--kb-line)] bg-white py-14 sm:py-20" aria-labelledby="questions">
            <div className="kb-wrap flex flex-wrap gap-14">
              <div className="flex flex-[1_1_280px] flex-col items-start gap-4">
                <span className="kb-eyebrow">Questions</span>
                <h2 id="questions" className="kb-h2 !text-[44px] max-sm:!text-[34px]">
                  Asked before
                </h2>
                <Link href="/faq" className="text-[15px] font-semibold">
                  See every question
                </Link>
              </div>
              <div className="min-w-0 flex-[2_1_560px]">
                <Faq items={faqs} />
              </div>
            </div>
          </section>
        ) : null}

        <section className="border-t border-[color:var(--kb-line)] py-14 sm:py-20" aria-labelledby="related">
          <div className="kb-wrap flex flex-col gap-8">
            <h2 id="related" className="text-[22px] font-semibold">
              Read next
            </h2>
            <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="kb-tile flex h-full flex-col gap-2 p-6 text-[color:var(--kb-ink)] no-underline hover:border-[color:var(--kb-ink)]">
                    <span className="text-[18px] font-semibold">{link.title}</span>
                    <span className="text-[15px] text-[color:var(--kb-ink-2)]">{link.body}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <NightCta {...cta} />
      </main>
      <SiteFooter inApp={inApp} />
    </>
  );
}

/** A bulleted list inside a section body. */
export function Points({ items }: { items: ReactNode[] }) {
  return (
    <ul className="m-0 flex list-disc flex-col gap-2 pl-5 marker:text-[color:var(--kb-brand)]">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

/** Numbered steps inside a section body. */
export function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="m-0 flex list-decimal flex-col gap-2 pl-5 marker:font-semibold marker:text-[color:var(--kb-brand)]">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ol>
  );
}
