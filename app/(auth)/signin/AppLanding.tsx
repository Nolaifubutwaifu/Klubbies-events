import Image from "next/image";
import Link from "next/link";
import { ScanEventButton } from "@/components/ScanEventButton";
import { BrandTile } from "@/components/ui";
import { appUrl } from "@/lib/env";

/**
 * The iPhone app's first screen for someone signed out: one screen, no
 * scrolling, only the ways in. It follows the app's animated loading screen,
 * which shows the same mark, so the mark settles here as the screen rises.
 * "How it works" opens the website in a browser sheet (`view=browser`, see
 * ios/KlubbiesEvents/AppConfig.swift) rather than turning the app into it.
 * It's a full URL and a plain <a> on purpose: the app only sees real page
 * loads, never Next's client-side navigation.
 */
const PHOTO = "absolute h-[190px] w-[150px] overflow-hidden rounded-[10px] border-4 border-white shadow-[0_18px_40px_-16px_rgb(22_24_29/0.45)]";

export function AppLanding() {
  return (
    <div className="theme-soft kb-branded flex h-dvh flex-col overflow-hidden bg-[color:var(--kb-cream)]">
      {/* Three event photos fanned out, from Klubbies' own marketing set. */}
      <div aria-hidden className="kb-rise relative mx-auto h-[min(330px,38dvh)] w-full max-w-[390px] flex-none">
        <span className={`${PHOTO} left-[18px] top-[70px] -rotate-[8deg]`}>
          <Image src="/marketing/sq-9.webp" alt="" fill sizes="150px" className="object-cover" />
        </span>
        <span className={`${PHOTO} left-1/2 top-[40px] z-[2] !h-[210px] !w-[160px] -translate-x-1/2 rotate-[2deg]`}>
          <Image src="/marketing/sq-5.webp" alt="" fill sizes="160px" className="object-cover" priority />
        </span>
        <span className={`${PHOTO} right-[18px] top-[84px] rotate-[9deg]`}>
          <Image src="/marketing/sq-4.webp" alt="" fill sizes="150px" className="object-cover" />
        </span>
        <span className="absolute bottom-0 left-1/2 z-[3] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white py-1.5 pl-1.5 pr-3.5 shadow-[0_10px_24px_-10px_rgb(22_24_29/0.35)]">
          <span className="relative block h-[30px] w-[30px] overflow-hidden rounded-full">
            <Image src="/marketing/selfie.webp" alt="" fill sizes="30px" className="object-cover" />
          </span>
          <span className="text-[14px] font-semibold">23 photos of you</span>
        </span>
      </div>

      <main className="flex flex-1 flex-col gap-3.5 px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-7">
        <span className="kb-rise kb-rise-2">
          <BrandTile size={40} />
        </span>
        <h1 className="kb-rise kb-rise-2 serif text-[40px] leading-[1.02]">Sign in to see your event photos</h1>
        <p className="kb-rise kb-rise-2 m-0 text-[14px] text-[color:var(--kb-ink-2)]">
          By continuing you agree to the <Link href="/terms">terms</Link> and <Link href="/privacy">privacy policy</Link>.
        </p>
        <div className="kb-rise kb-rise-3 mt-2 flex flex-col gap-2.5">
          <Link href="/signin?with=email" className="btn btn-primary btn-lg w-full no-underline">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
            Sign in with email
          </Link>
          <ScanEventButton className="btn btn-secondary btn-lg w-full" />
        </div>
        <div className="kb-rise kb-rise-3 mt-auto flex justify-center gap-7 text-[15px] font-medium">
          <Link href="/start" className="flex min-h-[44px] items-center">
            Create an event
          </Link>
          <a href={`${appUrl()}/how-it-works?view=browser`} className="flex min-h-[44px] items-center">
            How it works
          </a>
        </div>
      </main>
    </div>
  );
}
