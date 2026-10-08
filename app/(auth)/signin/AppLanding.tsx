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
export function AppLanding() {
  return (
    <div className="theme-soft kb-branded flex h-dvh flex-col overflow-hidden px-6 pb-4 pt-6">
      <div className="flex flex-1 flex-col justify-center">
        <div className="kb-rise flex flex-col items-center gap-3">
          <BrandTile size={76} />
          <span className="text-[22px] font-semibold tracking-[-0.02em] text-[color:var(--kb-ink)]">
            Klubbies <span className="font-normal text-[color:var(--kb-ink-3)]">Events</span>
          </span>
        </div>
        <h1 className="kb-rise kb-rise-2 mt-12 text-[34px] font-semibold leading-[1.08] tracking-[-0.03em]">
          Sign in to see your event photos
        </h1>
        <p className="kb-rise kb-rise-2 m-0 mt-4 text-[15px] leading-[1.5] text-[color:var(--kb-ink-2)]">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="font-semibold text-[color:var(--kb-brand)] underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-semibold text-[color:var(--kb-brand)] underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>

      <div className="kb-rise kb-rise-3 flex flex-col gap-3">
        <Link href="/signin?with=email" className="btn btn-primary btn-lg w-full no-underline">
          Sign in with email
        </Link>
        <ScanEventButton className="btn btn-secondary btn-lg w-full" />
        <div className="flex items-center justify-between pt-1 text-[15px]">
          <Link href="/start" className="flex min-h-[44px] items-center text-[color:var(--kb-ink-2)] no-underline">
            Create an event
          </Link>
          <a href={`${appUrl()}/?view=browser#how`} className="flex min-h-[44px] items-center font-semibold text-[color:var(--kb-brand)] no-underline">
            How it works
          </a>
        </div>
      </div>
    </div>
  );
}
