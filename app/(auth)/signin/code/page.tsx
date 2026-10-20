import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthHeading, AuthShell } from "@/components/AuthShell";
import { SIGNIN_COOKIE } from "@/lib/auth/flow";
import { authEventPreview } from "@/lib/auth/preview";
import { CodeForm } from "./CodeForm";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = { title: "Enter your code", robots: NO_INDEX };

export default async function CodePage(props: PageProps<"/signin/code">) {
  const params = await props.searchParams;
  const isCreate = params.flow === "create";
  const event = typeof params.event === "string" && /^[a-z0-9_]{1,48}$/i.test(params.event) ? params.event : undefined;
  const email = (await cookies()).get(SIGNIN_COOKIE)?.value;
  const restartHref = isCreate ? "/start" : event ? `/signin?event=${event}` : "/signin";
  if (!email) redirect(restartHref);
  const preview = await authEventPreview(event);
  const openLink = preview?.accessMode === "link";

  return (
    <AuthShell
      event={preview}
      backHref={restartHref}
      topLink={
        <Link href={restartHref} className="font-medium">
          Use a different email
        </Link>
      }
    >
      <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-[14px] bg-[color:var(--kb-ember-tint)] text-[color:var(--kb-ember)]" aria-hidden>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" />
        </svg>
      </span>
      <AuthHeading step={isCreate ? { at: 1, of: 2 } : undefined}>Check your email</AuthHeading>
      {/* The address is theirs, they just typed it, so spelling it back is a
          help, not a leak. */}
      <p className="mt-3 text-[16px] text-[color:var(--kb-ink-2)]">
        {/* Only an open-link event can say so plainly: anywhere else the
            answer stays neutral, so a guest list can't be probed. */}
        {openLink ? "We sent an 8 digit code to " : "If that address can open the event, an 8 digit code is on its way to "}
        <strong className="font-semibold text-[color:var(--kb-ink)]">{email}</strong>.
      </p>

      <div className="mt-6">
        <CodeForm
          event={event}
          help={
            isCreate
              ? "Check junk, then send it again."
              : openLink
                ? "Check junk and the spelling of your address, then send a new code."
                : preview
                  ? "Check junk. This event uses a guest list, so use the email you registered with; if that's what you used, ask the organiser to add you."
                  : "Check junk. Codes only go to addresses that are already in an event: open the event's link or QR code instead, or to organise a new event, start from Create an event."
          }
        />
      </div>
    </AuthShell>
  );
}
