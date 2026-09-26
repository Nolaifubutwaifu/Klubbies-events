import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthHeading, AuthNote, AuthShell, StepIndicator } from "@/components/AuthShell";
import { SIGNIN_COOKIE } from "@/lib/auth/flow";
import { CodeForm } from "./CodeForm";

export const metadata: Metadata = { title: "Enter your code" };

export default async function CodePage(props: PageProps<"/signin/code">) {
  const params = await props.searchParams;
  const isCreate = params.flow === "create";
  const club = typeof params.club === "string" && /^[a-z0-9_]{1,48}$/i.test(params.club) ? params.club : undefined;
  const email = (await cookies()).get(SIGNIN_COOKIE)?.value;
  const restartHref = isCreate ? "/start" : club ? `/signin?club=${club}` : "/signin";
  if (!email) redirect(restartHref);

  return (
    <AuthShell
      topLink={
        <Link href={restartHref} className="font-bold">
          Use a different email
        </Link>
      }
    >
      {isCreate ? <StepIndicator current={1} /> : null}
      <AuthHeading>Check your email</AuthHeading>
      {/* The address is theirs, they just typed it, so spelling it back is a
          help, not a leak. */}
      <p className="kb-lead mt-3 !text-[17px]">
        We sent a code to <strong className="font-bold text-[color:var(--kb-ink)]">{email}</strong>. It works for ten minutes.
      </p>

      <div className="mt-7">
        <CodeForm restartHref={restartHref} club={club} />
      </div>

      <AuthNote>
        {isCreate
          ? "Nothing arrived? Check junk, then send it again."
          : "Nothing arrived? Use the email your club has on its list. If that's what you used, ask your committee to add you."}
      </AuthNote>
    </AuthShell>
  );
}
