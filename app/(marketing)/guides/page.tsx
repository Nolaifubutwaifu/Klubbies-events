import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { GUIDES, PAGE_CARDS } from "@/lib/copy/pages";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Event Photo Sharing Guides",
  description: "Practical guides for organisers and photographers: sharing photos after a conference, Google Drive vs a private gallery, and getting photos out the same night.",
  path: "/guides",
});

/** The list of guides. Each guide is its own page under /guides. */
export default async function GuidesPage() {
  const inApp = await isNativeAppRequest();
  return (
    <>
      <SiteNav inApp={inApp} />
      <main>
        <section className="border-b border-[color:var(--kb-line)] pb-14 pt-12 sm:pb-16 sm:pt-24">
          <div className="kb-wrap flex flex-col gap-5">
            <span className="kb-eyebrow">Guides</span>
            <h1 className="kb-h1 max-w-[16ch] !text-[68px] !leading-[1.02] max-sm:!text-[44px]">Getting event photos to the people in them</h1>
            <p className="kb-lead m-0 max-w-[56ch]">
              Practical guides for organisers and photographers, whichever tool you use.
            </p>
          </div>
        </section>
        <section className="py-14 sm:py-20">
          <div className="kb-wrap">
            <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
              {GUIDES.map((href) => (
                <li key={href}>
                  <Link href={href} className="kb-tile flex h-full flex-col gap-3 p-7 text-[color:var(--kb-ink)] no-underline hover:border-[color:var(--kb-ink)]">
                    <span className="mono text-[14px] text-[color:var(--kb-brand)]">Guide</span>
                    <h2 className="text-[22px] font-semibold tracking-[-0.01em]">{PAGE_CARDS[href].title}</h2>
                    <span className="text-[15px] text-[color:var(--kb-ink-2)]">{PAGE_CARDS[href].body}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter inApp={inApp} />
    </>
  );
}
