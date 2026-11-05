import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthHeading, AuthShell } from "@/components/AuthShell";
import { NAME_STEP_PATH, hasDisplayName } from "@/lib/auth/sign-in-name";
import { getProfile, getSessionUser } from "@/lib/auth/session";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { SignInForm } from "../signin/SignInForm";

export const metadata: Metadata = { title: "Create an event", robots: { index: false, follow: true } };

const PANEL: { line: string; icon: React.ReactNode }[] = [
  { line: "Your logo and colour on every screen", icon: <path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" /> },
  { line: "Upload links for each photographer", icon: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" /> },
  {
    line: "A QR code and poster for the venue",
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3zM18 18h3v3h-3z" />
      </>
    ),
  },
  {
    line: "Attendees find their own photos with a selfie",
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
      </>
    ),
  },
];

/** The desktop panel: what the organiser gets, in four lines, on night. */
function Preview() {
  return (
    <div className="flex h-full flex-col justify-center gap-10 bg-[color:var(--kb-night)] p-16 text-white">
      <p className="serif m-0 max-w-[12ch] text-[52px] leading-[1.02] text-white">Ten minutes to set up. Photographers do the rest.</p>
      <ul className="m-0 flex list-none flex-col border-t border-[color:var(--kb-night-line)] p-0">
        {PANEL.map((row) => (
          <li key={row.line} className="flex items-center gap-4 border-b border-[color:var(--kb-night-line)] py-[18px] text-[17px]">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-[#1a2238] text-[#b3c1f6]" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                {row.icon}
              </svg>
            </span>
            {row.line}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function StartPage() {
  if (await getSessionUser()) {
    const profile = await getProfile();
    if (!hasDisplayName(profile?.display_name)) redirect(NAME_STEP_PATH);
    redirect("/admin/new");
  }
  const inApp = await isNativeAppRequest();

  return (
    <AuthShell
      panel={<Preview />}
      topLink={
        <>
          <span className="hidden sm:inline">Already have an account? </span>
          <Link href="/signin" className="font-semibold">
            Sign in
          </Link>
        </>
      }
      footer={
        <p className="m-0">
          <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
          {inApp ? null : (
            <>
              {" "}
              · <Link href="/refunds">Refunds</Link>
            </>
          )}
        </p>
      }
    >
      <AuthHeading step={{ at: 1, of: 2 }}>Create an event</AuthHeading>
      <p className="mt-3 text-[17px] text-[color:var(--kb-ink-2)]">
        First, who&apos;s running it. We&apos;ll email you a code to confirm it&apos;s you.
      </p>
      <div className="mt-6">
        <SignInForm flow="create" />
      </div>
      {inApp ? null : (
        <p className="m-0 mt-5 text-[14px] text-[color:var(--kb-ink-3)]">
          Setting up is free. You only pay if the event needs a bigger size.
        </p>
      )}
    </AuthShell>
  );
}
