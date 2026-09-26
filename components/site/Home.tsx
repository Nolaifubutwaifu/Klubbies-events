import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Faq } from "@/components/site/Faq";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import {
  CameraIcon,
  CheckIcon,
  DownloadIcon,
  FaceIcon,
  FlagIcon,
  ListIcon,
  LockIcon,
  SearchIcon,
  UploadIcon,
} from "@/components/soft/icons";
import { COMMITTEE_FEATURES, FACE, FAQS, MEMBER_FEATURES, PRICE, PRIVACY_PROMISES, STEPS, type Feature } from "@/lib/copy/site";

// Home, rebuilt from the design audit: nine sections, one job each, the price
// in the hero. Face recognition is the product's edge, so it gets its own
// section straight after the problem it solves; the decorative photo band
// from the canvas made way for it.

const PHOTOS = {
  crowd: { src: "/marketing/hero-1.jpg", alt: "Members with their arms up in a packed room at a club night" },
  friends: { src: "/marketing/hero-2.jpg", alt: "Two friends laughing with drinks at a club event" },
  dancefloor: { src: "/marketing/hero-3.jpg", alt: "Members dancing under green lights" },
  team: { src: "/marketing/hero-4.jpg", alt: "A sports team posing together on the field after a game" },
  ball: { src: "/marketing/night-ball.jpg", alt: "Members celebrating under confetti at the end of season party" },
  hall: { src: "/marketing/night-bigone.jpg", alt: "The whole club dancing in a decorated hall" },
  floor: { src: "/marketing/night-dancefloor.jpg", alt: "Members dancing close together on a busy dance floor" },
  final: { src: "/marketing/night-grandfinal.jpg", alt: "A player in black striking the ball during the grand final" },
} as const;

type PhotoKey = keyof typeof PHOTOS;

function Photo({ name, className = "", sizes, decorative = false }: { name: PhotoKey; className?: string; sizes: string; decorative?: boolean }) {
  const photo = PHOTOS[name];
  return (
    <span className={`relative block overflow-hidden bg-[color:var(--kb-sand)] ${className}`}>
      <Image src={photo.src} alt={decorative ? "" : photo.alt} fill sizes={sizes} className="object-cover" />
    </span>
  );
}

function Icon({ name }: { name: Feature["icon"] }) {
  const map: Record<Feature["icon"], ReactNode> = {
    search: <SearchIcon />,
    face: <FaceIcon />,
    heart: <FaceIcon />,
    download: <DownloadIcon />,
    flag: <FlagIcon />,
    bell: <FlagIcon />,
    list: <ListIcon />,
    upload: <UploadIcon />,
    camera: <CameraIcon />,
  };
  return (
    <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-[color:var(--kb-ember-tint)] text-[color:var(--kb-ember-deep)]">
      {map[name]}
    </span>
  );
}

function SectionHead({ title, lead, children }: { title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-[760px]">
        <h2 className="kb-h2">{title}</h2>
        {lead ? <p className="kb-lead mt-4">{lead}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** The album card from the hero: what a member actually opens. */
function AlbumCard() {
  return (
    <div className="kb-card w-full max-w-[520px] p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-[color:var(--kb-ink)] text-[15px] font-bold text-white">
          UM
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-[family-name:var(--kb-font-display)] text-[19px] font-semibold">UM Semester 2 Ball</span>
          <span className="block truncate text-[14px] text-[color:var(--kb-ink-3)]">UniMelb FC · 412 photos · 9 videos</span>
        </span>
        <span className="soft-chip hidden sm:inline-flex">
          <LockIcon size={15} />
          Members only
        </span>
      </div>
      <div className="mt-4 grid aspect-[4/3] grid-cols-3 grid-rows-2 gap-1.5">
        <Photo name="friends" className="col-span-2 row-span-2 rounded-[var(--kb-r-photo)]" sizes="(max-width: 640px) 60vw, 330px" />
        <Photo name="crowd" className="rounded-[var(--kb-r-photo)]" sizes="170px" />
        <span className="relative block overflow-hidden rounded-[var(--kb-r-photo)]">
          <Image src={PHOTOS.floor.src} alt="" fill sizes="170px" className="object-cover" />
          <span className="absolute inset-0 flex items-center justify-center bg-[rgb(43_34_40/0.6)] text-[17px] font-bold text-white">+409</span>
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className="soft-chip">
          <FaceIcon size={16} />
          23 photos of you
        </span>
        <span className="flex items-center gap-1.5 text-[14px] font-medium text-[color:var(--kb-ink-2)]">
          <DownloadIcon size={16} />
          Save all, full quality
        </span>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="kb-section !pt-14 sm:!pt-20">
      <div className="kb-wrap grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div>
          <span className="soft-chip soft-chip-muted">Private photo albums for clubs</span>
          <h1 className="kb-h1 mt-5 max-w-[14ch]">
            Every photo from <span className="kb-accent">Friday</span>, waiting on <span className="kb-accent">Saturday</span>.
          </h1>
          <p className="kb-lead mt-6 max-w-[46ch]">
            One private album for your club&rsquo;s nights out. Only people on your member list get in, and every member can
            find the photos they&rsquo;re in.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/start" className="btn btn-primary btn-lg w-full sm:w-auto">
              Start your club
            </Link>
            <Link href="/signin" className="btn btn-secondary btn-lg w-full sm:w-auto">
              I&rsquo;m a member, log in
            </Link>
          </div>
          <ul className="m-0 mt-5 flex list-none flex-wrap justify-center gap-x-5 gap-y-1 p-0 text-[14px] font-medium text-[color:var(--kb-ink-2)] sm:justify-start">
            {PRICE.trust.map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <CheckIcon size={16} className="text-[color:var(--kb-ember-deep)]" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-center lg:justify-end">
          <AlbumCard />
        </div>
      </div>
    </section>
  );
}

function Problem() {
  const chat = [
    { who: "Tilly", text: "anyone got the ball photos??" },
    { who: "Mahi", text: "drive.google.com/drive/folders/1kQ…" },
    { who: "Jack", text: "says I need access. request?" },
    { who: "Sofia", text: "can someone reupload, it's all 200kb now" },
  ];
  return (
    <section className="kb-section kb-sand">
      <div className="kb-wrap">
        <SectionHead
          title={
            <>
              The Google Drive link is <span className="kb-accent">not a system</span>.
            </>
          }
          lead="Every committee has tried it. It works for about nine days."
        />
        <div className="mt-12 grid items-start gap-6 lg:grid-cols-2">
          <div className="kb-card p-6 sm:p-8">
            <span className="soft-chip soft-chip-muted">Before: the club group chat</span>
            <ul className="m-0 mt-5 flex list-none flex-col gap-3 p-0">
              {chat.map((line, i) => (
                <li key={line.text} className={`flex-col items-start gap-1 ${i === 2 ? "hidden sm:flex" : "flex"}`}>
                  <span className="text-[14px] font-bold text-[color:var(--kb-ink-2)]">{line.who}</span>
                  <span className="rounded-[16px] rounded-tl-[6px] bg-[color:var(--kb-sand)] px-4 py-2.5 text-[15px] text-[color:var(--kb-ink)]">{line.text}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 hidden flex-wrap gap-2 sm:flex">
              {["Link escapes the club", "Compressed to mush", "Gone when the media officer graduates"].map((chip) => (
                <span key={chip} className="soft-chip soft-chip-muted">
                  {chip}
                </span>
              ))}
            </div>
          </div>
          <div className="kb-card hidden border-2 !border-[color:var(--kb-ember)] p-6 sm:block sm:p-8">
            <span className="soft-chip">After: one Klubbies album</span>
            <div className="mt-5 grid grid-cols-3 gap-1.5">
              <Photo name="ball" className="col-span-2 row-span-2 aspect-square rounded-[var(--kb-r-photo)]" sizes="(max-width: 1024px) 60vw, 380px" />
              <Photo name="team" className="aspect-square rounded-[var(--kb-r-photo)]" sizes="190px" />
              <Photo name="hall" className="aspect-square rounded-[var(--kb-r-photo)]" sizes="190px" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Full quality, always", "The member list is the door", "Still here in 2030"].map((chip) => (
                <span key={chip} className="soft-chip">
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The product's edge: members find themselves without scrolling 400 photos. */
function PhotosOfYou() {
  const nights = [
    { title: "Semester 2 Ball", count: 9, photos: ["friends", "ball", "floor"] as PhotoKey[] },
    { title: "Grand final", count: 4, photos: ["team", "final", "crowd"] as PhotoKey[] },
  ];
  return (
    <section className="kb-section">
      <div className="kb-wrap grid items-center gap-12 lg:grid-cols-2">
        <div>
          <span className="soft-chip">
            <FaceIcon size={16} />
            Photos of you
          </span>
          <h2 className="kb-h2 mt-5">
            Find every photo <span className="kb-accent">of you</span>.
          </h2>
          <p className="kb-lead mt-4 max-w-[48ch]">{FACE.lead}</p>
          <ul className="m-0 mt-8 flex list-none flex-col gap-5 p-0">
            {FACE.points.map((point) => (
              <li key={point.title} className="flex gap-4">
                <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[color:var(--kb-ink)] text-white">
                  <CheckIcon size={16} />
                </span>
                <span>
                  <span className="kb-h3 block !text-[19px]">{point.title}</span>
                  <span className="kb-body mt-1 block">{point.body}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="kb-caption mt-6 max-w-[56ch]">{FACE.caveat}</p>
        </div>

        {/* The page a member sees: stacked by the night, the way the app does it. */}
        <div className="kb-card mx-auto hidden w-full max-w-[520px] p-5 sm:block sm:p-6">
          <div className="flex items-center gap-3">
            <span className="relative h-14 w-14 flex-none overflow-hidden rounded-full ring-4 ring-[color:var(--kb-ember-tint)]">
              <Image src="/marketing/avatar-janci.jpg" alt="" fill sizes="56px" className="object-cover" />
            </span>
            <span>
              <span className="block font-[family-name:var(--kb-font-display)] text-[21px] font-semibold">Photos of you</span>
              <span className="block text-[14px] text-[color:var(--kb-ink-3)]">13 photos across 2 nights · only you see this</span>
            </span>
          </div>
          {nights.map((night, i) => (
            <div key={night.title} className={`mt-5 ${i > 0 ? "hidden sm:block" : ""}`}>
              <div className="flex items-baseline justify-between">
                <span className="text-[15px] font-bold">{night.title}</span>
                <span className="text-[14px] text-[color:var(--kb-ink-3)]">{night.count} of you</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {night.photos.map((name) => (
                  <Photo key={name} name={name} className="aspect-square rounded-[12px]" sizes="160px" decorative />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section className="kb-section kb-sand">
      <div className="kb-wrap">
        <SectionHead
          title={
            <>
              Three steps, <span className="kb-accent">once</span>.
            </>
          }
          lead="Set up on a Sunday arvo. Every event after that is a drag and drop."
        >
          <Link href="/how-it-works" className="kb-link">
            See the full walkthrough
          </Link>
        </SectionHead>
        <ol className="m-0 mt-12 grid list-none gap-5 p-0 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="kb-card flex flex-col gap-2 p-6 sm:p-7">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--kb-ember)] text-[17px] font-bold text-white">{i + 1}</span>
              <span className="kb-h3 mt-3">{step.title}</span>
              <span className="kb-body">{step.short}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FeatureList({ items }: { items: Feature[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-4 p-0 sm:gap-6">
      {items.map((item) => (
        <li key={item.title} className="flex items-center gap-4 sm:items-start">
          <Icon name={item.icon} />
          <span>
            <span className="kb-h3 block !text-[19px]">{item.title}</span>
            <span className="kb-body mt-1 hidden sm:block">{item.body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function TwoSides() {
  return (
    <section className="kb-section">
      <div className="kb-wrap">
        <SectionHead
          title={
            <>
              Two sides of the <span className="kb-accent">same night</span>.
            </>
          }
          lead="Members get a camera roll. The committee gets the controls."
        />
        <div className="mt-12 grid items-start gap-6 lg:grid-cols-2">
          <div className="kb-card p-6 sm:p-9">
            <span className="soft-chip">For members</span>
            <div className="mt-6">
              <FeatureList items={MEMBER_FEATURES} />
            </div>
          </div>
          <div className="kb-card p-6 sm:p-9">
            <span className="soft-chip kb-chip-ink">For committees</span>
            <div className="mt-6">
              <FeatureList items={COMMITTEE_FEATURES} />
            </div>
            <div className="mt-8 hidden rounded-[20px] bg-[color:var(--kb-sand)] p-5 sm:block">
              <span className="kb-h3 block !text-[19px]">Your club&rsquo;s history doesn&rsquo;t graduate</span>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-2 rounded-[14px] bg-white px-3 py-2 text-[14px]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--kb-ember-tint)] text-[14px] font-bold text-[color:var(--kb-ember-deep)]" aria-hidden>
                    MP
                  </span>
                  <span>
                    <span className="block font-bold">Mahi Patel</span>
                    <span className="block text-[color:var(--kb-ink-3)]">President 2026</span>
                  </span>
                </span>
                <span className="text-[color:var(--kb-ember-deep)]" aria-label="hands over to">
                  &rarr;
                </span>
                <span className="flex items-center gap-2 rounded-[14px] bg-white px-3 py-2 text-[14px]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--kb-ink)] text-[14px] font-bold text-white" aria-hidden>
                    AC
                  </span>
                  <span>
                    <span className="block font-bold">Amara Chen</span>
                    <span className="block text-[color:var(--kb-ink-3)]">President 2027</span>
                  </span>
                </span>
              </div>
              <p className="kb-body mt-4 !text-[15px]">
                Hand the club to next year&rsquo;s committee in one step. The albums stay with the club, not in a
                graduate&rsquo;s personal Drive.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const REVIEWS = [
  {
    name: "Alex",
    role: "Executive, UOM Boardgames",
    avatar: "/marketing/avatar-alex.jpg",
    quote:
      "I love Klubbies! In the past, we've shared all of our event pictures with Google Drive, and it was just inefficient and ugly. Now it's way smoother we can get the pictures to all our members.",
  },
  {
    name: "Hannah",
    role: "Team leader, TUG Racing",
    avatar: "/marketing/avatar-hannah.jpg",
    quote: "We've had many events this past years and Klubbies had made it really easy to keep our photos organized.",
  },
  {
    name: "Janci",
    role: "President, BBE Club WU",
    avatar: "/marketing/avatar-janci.jpg",
    quote: "We take a lot of pictures during trips and distributing them has always been a pain. With Klubbies that's history.",
  },
];

function Testimonials() {
  return (
    <section className="kb-section kb-sand">
      <div className="kb-wrap">
        <SectionHead
          title={
            <>
              What committees <span className="kb-accent">say</span>.
            </>
          }
        />
        <div className="-mx-[var(--kb-gutter)] mt-8 flex snap-x snap-mandatory items-start gap-4 overflow-x-auto px-[var(--kb-gutter)] pb-2 sm:mt-12 md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0">
          {REVIEWS.map((review) => (
            <figure key={review.name} className="kb-card m-0 flex w-[82%] flex-none snap-start flex-col gap-5 p-6 sm:p-7 md:w-auto">
              <blockquote className="m-0 text-[16px] leading-[1.6] text-[color:var(--kb-ink)]">&ldquo;{review.quote}&rdquo;</blockquote>
              <figcaption className="flex items-center gap-3">
                <span className="relative h-12 w-12 flex-none overflow-hidden rounded-full">
                  <Image src={review.avatar} alt={`${review.name}`} fill sizes="48px" className="object-cover" />
                </span>
                <span>
                  <span className="block font-bold">{review.name}</span>
                  <span className="block text-[14px] text-[color:var(--kb-ink-2)]">{review.role}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Privacy() {
  return (
    <section className="kb-section kb-ink-band">
      <div className="kb-wrap grid items-center gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div>
          <span className="soft-chip">Privacy and consent</span>
          <h2 className="kb-h2 mt-5">
            Nobody gets in who isn&rsquo;t <span className="kb-accent">on the list</span>.
          </h2>
          <ul className="m-0 mt-8 grid list-none gap-x-8 gap-y-3 p-0 sm:mt-10 sm:grid-cols-2 sm:gap-y-7">
            {PRIVACY_PROMISES.map((item, i) => (
              <li key={item.title} className={i === 1 ? "hidden sm:block" : ""}>
                <span className="flex items-center gap-2 font-[family-name:var(--kb-font-display)] text-[19px] font-semibold">
                  <CheckIcon size={18} className="text-[color:var(--kb-ember-on-dark)]" />
                  {item.title}
                </span>
                <span className="mt-1 hidden text-[16px] leading-[1.6] text-white/85 sm:block">{item.body}</span>
              </li>
            ))}
          </ul>
          <Link href="/privacy" className="kb-link mt-6 !text-[color:var(--kb-ember-on-dark)]">
            Read the plain English privacy page
          </Link>
        </div>
        <div className="hidden rounded-[var(--kb-r-panel)] bg-white p-6 text-[color:var(--kb-ink)] sm:block sm:p-8">
          <span className="block text-[14px] text-[color:var(--kb-ink-3)]">klubbies.app/c/umfc</span>
          <span className="mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--kb-sand)]">
            <LockIcon size={22} />
          </span>
          <span className="kb-h3 mt-4 block">You&rsquo;re not on the list.</span>
          <p className="kb-body mt-2">
            This album belongs to UniMelb FC. Ask your committee to add your email and this page opens.
          </p>
          <p className="kb-caption mt-5">No preview. No thumbnails. Nothing leaks from this page.</p>
        </div>
      </div>
    </section>
  );
}

function PricingAndFaq() {
  return (
    <section id="pricing" className="kb-section scroll-mt-4">
      <div className="kb-wrap grid items-start gap-12 lg:grid-cols-[440px_minmax(0,1fr)]">
        <div className="kb-card p-7 sm:p-9">
          <span className="soft-chip">One plan, that&rsquo;s it</span>
          <p className="mt-5 font-[family-name:var(--kb-font-display)] text-[56px] font-bold leading-none">
            {PRICE.amount}
            <span className="ml-2 text-[19px] font-semibold text-[color:var(--kb-ink-2)]">a month, per club</span>
          </p>
          <p className="kb-body mt-3">Not per member. Not per gigabyte.</p>
          <ul className="m-0 mt-6 flex list-none flex-col gap-3 p-0">
            {PRICE.includes.map((item, i) => (
              <li key={item} className={`gap-3 text-[16px] ${i === 3 ? "hidden sm:flex" : "flex"}`}>
                <CheckIcon size={20} className="mt-0.5 flex-none text-[color:var(--kb-ember-deep)]" />
                {item}
              </li>
            ))}
          </ul>
          <Link href="/start" className="btn btn-primary mt-6 w-full">
            Start your club
          </Link>
          <p className="kb-caption mt-4 text-center">{PRICE.note}</p>
        </div>
        <div id="questions" className="scroll-mt-4">
          <h2 className="kb-h2">
            Questions committees <span className="kb-accent">ask</span>.
          </h2>
          <div className="mt-8">
            <div className="sm:hidden">
              <Faq items={FAQS.slice(0, 3)} />
            </div>
            <div className="hidden sm:block">
              <Faq items={[...FAQS]} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-[color:var(--kb-ink)]">
      <Image src={PHOTOS.hall.src} alt="" fill sizes="100vw" className="object-cover opacity-35" />
      <div className="kb-wrap relative kb-section text-center">
        <h2 className="kb-h2 mx-auto max-w-[18ch] text-white">Your next event is this weekend.</h2>
        <p className="kb-lead mx-auto mt-4 max-w-[44ch] !text-white/90">
          Set the club up tonight and the photos have somewhere to land on Saturday morning.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/start" className="btn btn-primary btn-lg">
            Start your club
          </Link>
          <Link href="/signin" className="btn btn-on-dark btn-lg">
            I&rsquo;m a member, log in
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteNav />
      <main className="flex-1">
        <Hero />
        <Problem />
        <PhotosOfYou />
        <Steps />
        <TwoSides />
        <Testimonials />
        <Privacy />
        <PricingAndFaq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
