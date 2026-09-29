import type { Metadata } from "next";
import Link from "next/link";
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
  const groups = GROUPS.filter((group) => !(inApp && group === "Pricing"));

  return (
    <>
      <SiteNav current="faq" inApp={inApp} />
      <main>
        <section className="kb-section !pb-8 !pt-12 sm:!pt-20">
          <div className="kb-wrap flex flex-col gap-4">
            <span className="kb-eyebrow">FAQ</span>
            <h1 className="kb-h1 max-w-[18ch]">Frequently asked questions</h1>
            <p className="kb-lead m-0 max-w-[56ch]">
              Something not answered here? <Link href="/support">Get in touch</Link> and we&apos;ll reply within two
              working days.
            </p>
          </div>
        </section>
        <section className="kb-section !pt-0">
          <div className="kb-wrap flex max-w-[900px] flex-col gap-12">
            {groups.map((group) => (
              <div key={group} className="flex flex-col gap-4">
                <h2 className="kb-h3 !text-[20px]">{group}</h2>
                <Faq items={FAQS.filter((item) => item.group === group)} />
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter inApp={inApp} />
    </>
  );
}
