import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthHeading, AuthNote, AuthShell } from "@/components/AuthShell";
import { SIGNIN_COOKIE } from "@/lib/auth/flow";
import { CodeForm } from "./CodeForm";

export const metadata: Metadata = { title: "Enter your code" };

export default async function CodePage(props: PageProps<"/signin/code">) {
  const params = await props.searchParams;
  const isCreate = params.flow === "create";
  const event = typeof params.event === "string" && /^[a-z0-9_]{1,48}$/i.test(params.event) ? params.event : undefined;
  const email = (await cookies()).get(SIGNIN_COOKIE)?.value;
  const restartHref = isCreate ? "/start" : event ? `/signin?event=${event}` : "/signin";
  if (!email) redirect(restartHref);

  return (
    <AuthShell
      topLink={
        <Link href={restartHref} className="font-medium">
          Use a different email
        </Link>
      }
    >
      <AuthHeading chip={isCreate ? "Step 1 of 2" : undefined}>Check your email</AuthHeading>
      {/* The address is theirs, they just typed it, so spelling it back is a
          help, not a leak. */}
      <p className="kb-lead mt-3 !text-[16px]">
        If that address can open the event, a code is on its way to <strong className="font-medium text-[color:var(--kb-ink)]">{email}</strong>. It works for ten minutes.
      </p>

      <div className="mt-7">
        <CodeForm restartHref={restartHref} event={event} />
      </div>

      <AuthNote>
        {isCreate
          ? "Nothing arrived? Check junk, then send it again."
          : "Nothing arrived? Check junk. For a guest-list event, use the email you registered with; if that's what you used, ask the organiser to add you."}
      </AuthNote>
    </AuthShell>
  );
}
