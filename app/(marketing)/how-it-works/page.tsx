import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Faq } from "@/components/site/Faq";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { CheckIcon, FaceIcon, LockIcon } from "@/components/soft/icons";
import { FACE, PRICE, STEPS } from "@/lib/copy/site";

export const metadata: Metadata = { title: "How Klubbies works" };

const MORE_STEPS = [
  {
    title: "Everyone sees their club, nobody else does",
    body: "Albums are private to the people on that club's member list. Every photo is served through a link that expires within minutes, so nothing escapes into a group chat. Members can download originals when you allow it.",
  },
  {
    title: "Members find the photos they're in",
    body: `${FACE.lead} ${FACE.points[0].body}`,
  },
  {
    title: "People join and leave",
    body: "Give roles like Committee or Treasurer and decide what each role can do: add members, make albums, upload photos. When someone leaves, they keep access to earlier albums for 30 days, get an email about it, and then their access ends by itself.",
  },
];

const ALL_STEPS = [...STEPS.map((s) => ({ title: s.title, body: s.body })), ...MORE_STEPS];

const FAQS = [
  { q: "What does it cost?", a: `${PRICE.line}. One price, unlimited members, unlimited photos and videos.` },
  {
    q: "Who can see our photos?",
    a: "Only people on your member list who have confirmed their email. Nothing is public and nothing is indexed by search engines.",
  },
  {
    q: "Is face recognition on by default?",
    a: "Yes, for the club, and the committee can switch it off in Settings. Every member is told it's on. Only members who add their own selfie are ever matched, and each of them sees only their own photos.",
  },
  { q: "Can members add their own photos?", a: "Yes, per album. Set who can add photos to Any member, or leave it on Committee only." },
  { q: "Where is our data stored?", a: "In Sydney, Australia." },
  {
    q: "Can we leave?",
    a: "Cancel any time. You keep access until the end of the month you paid for, and we give at least 30 days' notice before deleting anything.",
  },
];

function Panel({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-center rounded-[var(--kb-r-panel)] lg:min-h-[320px] bg-[color:var(--kb-sand)] p-4 sm:p-10">{children}</div>;
}

function MappingVisual() {
  return (
    <div className="kb-card w-full max-w-[420px] p-5">
      <div className="flex items-baseline justify-between">
        <span className="font-bold">members-s2-2026.csv</span>
        <span className="text-[14px] text-[color:var(--kb-ink-3)]">128 rows</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-[14px]">
        {[
          ["Name column", "Full name"],
          ["Email column", "Email"],
        ].map(([label, value]) => (
          <span key={label} className="flex flex-col gap-1">
            <span className="font-bold">{label}</span>
            <span className="rounded-[12px] border-[1.5px] border-[color:var(--kb-line-input)] px-3 py-2">{value}</span>
          </span>
        ))}
      </div>
      <ul className="m-0 mt-4 flex list-none flex-col p-0 text-[14px]">
        {[
          ["Tilly Nguyen", "t.nguyen@student.unimelb.edu.au"],
          ["Mahi Patel", "m.patel@student.unimelb.edu.au"],
        ].map(([name, email]) => (
          <li key={name} className="flex justify-between gap-3 border-t border-[color:var(--kb-line)] py-2">
            <span className="font-medium">{name}</span>
            <span className="truncate text-[color:var(--kb-ink-3)]">{email}</span>
          </li>
        ))}
      </ul>
      <span className="btn btn-primary mt-3 w-full !min-h-[44px]" aria-hidden>
        Add 128 members
      </span>
    </div>
  );
}

function CodeVisual() {
  const digits = ["4", "8", "1", "7", "", "", "", ""];
  return (
    <div className="kb-card w-full max-w-[420px] p-5 text-center">
      <span className="text-[14px] text-[color:var(--kb-ink-3)]">Code sent to t.nguyen@student…</span>
      <div className="mt-4 flex justify-center gap-1 sm:gap-1.5">
        {digits.map((digit, i) => (
          <span
            key={i}
            className={`flex h-11 w-[30px] items-center sm:h-12 sm:w-9 justify-center rounded-[10px] border-[1.5px] font-[family-name:var(--kb-font-display)] text-[20px] font-semibold ${digit ? "border-[color:var(--kb-ink)]" : "border-[color:var(--kb-line-strong)]"}`}
          >
            {digit}
          </span>
        ))}
      </div>
      <span className="mt-4 flex items-center justify-center gap-2 text-[14px] font-medium">
        <CheckIcon size={16} className="text-[color:var(--kb-ember-deep)]" />
        On the list, code correct: you&rsquo;re in.
      </span>
    </div>
  );
}

function UploadVisual() {
  const rows = [
    ["IMG_4482.HEIC", 100],
    ["IMG_4483.HEIC", 72],
    ["MVI_0091.MOV · 1.4 GB", 18],
  ] as const;
  return (
    <div className="kb-card w-full max-w-[420px] p-5">
      <span className="font-bold">Adding 412 files to Semester 2 Ball</span>
      <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0 text-[14px]">
        {rows.map(([name, pct]) => (
          <li key={name}>
            <span className="flex justify-between">
              <span>{name}</span>
              <span className="text-[color:var(--kb-ink-3)]">{pct === 100 ? "Done" : `${pct}%`}</span>
            </span>
            <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-[color:var(--kb-sand)]">
              <span className="block h-full rounded-full bg-[color:var(--kb-ember)]" style={{ width: `${pct}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AlbumsVisual() {
  const albums = [
    ["Semester 2 Ball", "/marketing/night-ball.jpg"],
    ["Round 7 vs Monash", "/marketing/night-grandfinal.jpg"],
    ["First social", "/marketing/hero-1.jpg"],
    ["End of season", "/marketing/night-bigone.jpg"],
  ];
  return (
    <div className="kb-card w-full max-w-[420px] p-5">
      <div className="flex items-center justify-between">
        <span className="font-bold">UniMelb FC albums</span>
        <span className="soft-chip">
          <LockIcon size={14} />
          Members only
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {albums.map(([title, src]) => (
          <span key={title}>
            <span className="relative block aspect-[4/3] overflow-hidden rounded-[12px]">
              <Image src={src} alt="" fill sizes="190px" className="object-cover" />
            </span>
            <span className="mt-1.5 block truncate text-[14px] font-medium">{title}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function FacesVisual() {
  return (
    <div className="kb-card w-full max-w-[420px] p-5">
      <div className="flex items-center gap-3">
        <span className="relative h-12 w-12 flex-none overflow-hidden rounded-full ring-4 ring-[color:var(--kb-ember-tint)]">
          <Image src="/marketing/avatar-hannah.jpg" alt="" fill sizes="48px" className="object-cover" />
        </span>
        <span>
          <span className="block font-bold">Photos of you</span>
          <span className="block text-[14px] text-[color:var(--kb-ink-3)]">Only you see this page</span>
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-1.5">
        {["/marketing/hero-2.jpg", "/marketing/night-dancefloor.jpg", "/marketing/hero-1.jpg"].map((src) => (
          <span key={src} className="relative block aspect-square overflow-hidden rounded-[10px]">
            <Image src={src} alt="" fill sizes="130px" className="object-cover" />
          </span>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-[14px] bg-[color:var(--kb-sand)] p-3 text-[14px]">
        <span className="flex items-center gap-2 font-medium">
          <FaceIcon size={16} />
          Is this you?
        </span>
        <span className="flex gap-2">
          <span className="rounded-full bg-white px-3 py-1 font-bold">Not me</span>
          <span className="rounded-full bg-[color:var(--kb-ember)] px-3 py-1 font-bold text-white">Yes</span>
        </span>
      </div>
    </div>
  );
}

function MembersVisual() {
  const people = [
    ["MP", "Mahi Patel", "Committee"],
    ["LD", "Lachlan Doyle", "Treasurer"],
    ["TN", "Tilly Nguyen", "Member"],
  ];
  return (
    <div className="kb-card w-full max-w-[420px] p-5">
      <ul className="m-0 flex list-none flex-col p-0">
        {people.map(([initials, name, role]) => (
          <li key={name} className="flex items-center gap-3 border-b border-[color:var(--kb-line)] py-2.5 text-[15px]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--kb-sand)] text-[14px] font-bold" aria-hidden>
              {initials}
            </span>
            <span className="flex-1 font-medium">{name}</span>
            <span className="soft-chip soft-chip-muted">{role}</span>
          </li>
        ))}
        <li className="flex items-center gap-3 py-2.5 text-[15px]">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--kb-sand)] text-[14px] font-bold" aria-hidden>
            JR
          </span>
          <span className="flex-1">
            <span className="block font-medium">Jack Ryan</span>
            <span className="block text-[14px] text-[color:var(--kb-ember-deep)]">Left the list · 30 days of access left</span>
          </span>
        </li>
      </ul>
    </div>
  );
}

const VISUALS = [<MappingVisual key="a" />, <UploadVisual key="c" />, <CodeVisual key="b" />, <AlbumsVisual key="d" />, <FacesVisual key="f" />, <MembersVisual key="e" />];

export default function HowItWorksPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteNav current="how" />
      <main className="flex-1">
        <section className="kb-section !pb-10">
          <div className="kb-wrap">
            <span className="soft-chip soft-chip-muted">How it works</span>
            <h1 className="kb-h1 mt-5 max-w-[18ch]">
              One member list. One <span className="kb-accent">private</span> place for the photos.
            </h1>
            <p className="kb-lead mt-6 max-w-[60ch]">
              Klubbies replaces the shared drive folder that half the committee can edit and anyone can forward. Here is
              the whole thing, start to finish.
            </p>
          </div>
        </section>

        <div className="kb-wrap flex flex-col gap-16 pb-[var(--kb-section-y)] sm:gap-24">
          {ALL_STEPS.map((step, i) => (
            <section key={step.title} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
              <div className={i % 2 ? "lg:order-2" : ""}>
                <span className="text-[16px] font-bold text-[color:var(--kb-ember-deep)]">Step {i + 1}</span>
                <h2 className="mt-2 font-[family-name:var(--kb-font-display)] text-[30px] font-bold leading-[1.1] sm:text-[36px]">{step.title}</h2>
                <p className="mt-4 max-w-[54ch] text-[17px] leading-[1.6] text-[color:var(--kb-ink-2)]">{step.body}</p>
              </div>
              <Panel>{VISUALS[i]}</Panel>
            </section>
          ))}
        </div>

        <section className="kb-section kb-sand">
          <div className="kb-wrap grid items-start gap-10 lg:grid-cols-[360px_minmax(0,1fr)]">
            <h2 className="kb-h2">
              Questions we <span className="kb-accent">get</span>.
            </h2>
            <Faq items={FAQS} />
          </div>
        </section>

        <section className="relative overflow-hidden bg-[color:var(--kb-ink)]">
          <Image src="/marketing/night-bigone.jpg" alt="" fill sizes="100vw" className="object-cover opacity-35" />
          <div className="kb-wrap kb-section relative text-center">
            <h2 className="kb-h2 mx-auto max-w-[18ch] text-white">Ready when your next event is.</h2>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/start" className="btn btn-primary btn-lg">
                Start your club
              </Link>
              <Link href="/signin" className="btn btn-on-dark btn-lg">
                Log in
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
