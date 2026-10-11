import type { Metadata } from "next";
import Link from "next/link";
import { TopicNav } from "@/components/LegalContents";
import { slug } from "@/components/LegalPage";
import { Faq } from "@/components/site/Faq";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { FAQS, type FaqGroup } from "@/lib/copy/site";
import { isNativeAppRequest } from "@/lib/native-app-server";

export const metadata: Metadata = { title: "Frequently asked questions" };

const GROUPS: FaqGroup[] = ["Getting started", "Photos and privacy", "Pricing"];

/** Every question in one place, grouped. Pricing questions are left out inside the iPhone app. */
export default async function FaqPage() {
  const inApp = await isNativeAppRequest();
  const groups = GROUPS.filter((group) => !(inApp && group === "Pricing")).map((group) => ({
    id: slug(group),
    title: group,
    items: FAQS.filter((item) => item.group === group),
  }));

  return (
    <>
      <SiteNav current="faq" inApp={inApp} />
      <main>
        <section className="border-b border-[color:var(--kb-line)] pb-14 pt-12 sm:pb-16 sm:pt-24">
          <div className="kb-wrap flex flex-col gap-5">
            <span className="kb-eyebrow">FAQ</span>
            <h1 className="kb-h1 max-w-[14ch] !text-[80px] !leading-none max-sm:!text-[50px]">Frequently asked questions</h1>
            <p className="kb-lead m-0 max-w-[52ch]">
              Answers for organisers, photographers and attendees. Can&apos;t find yours?{" "}
              <Link href="/support#contact">Contact us</Link>.
            </p>
          </div>
        </section>

        <section className="pb-20 pt-12 sm:pb-28 sm:pt-16">
          <div className="kb-wrap flex flex-wrap items-start gap-14">
            <aside className="hidden max-w-[280px] flex-[1_1_240px] lg:sticky lg:top-[104px] lg:block">
              <TopicNav items={groups.map((group) => ({ id: group.id, title: group.title, count: group.items.length }))} />
            </aside>
            <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-14">
              {groups.map((group, index) => (
                <div key={group.id} className="flex flex-col">
                  <h2 id={group.id} className="scroll-mt-24 border-b border-[color:var(--kb-ink)] pb-3 text-[24px] font-semibold">
                    {group.title}
                  </h2>
                  {/* The first group is open so the page starts with answers, not a list. */}
                  <div className="[&>div]:border-t-0">
                    <Faq items={group.items} openFirst={index === 0} />
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-5 rounded-[14px] border border-[color:var(--kb-line)] bg-white p-8">
                <div className="flex flex-col gap-1">
                  <span className="text-[20px] font-semibold">Still have a question?</span>
                  <span className="text-[color:var(--kb-ink-2)]">Send it through the contact form and we&apos;ll reply by email.</span>
                </div>
                <Link href="/support#contact" className="btn btn-secondary no-underline">
                  Contact us
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter inApp={inApp} />
    </>
  );
}
