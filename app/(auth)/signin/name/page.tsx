import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthHeading, AuthShell } from "@/components/AuthShell";
import { NEXT_COOKIE, safeNextPath } from "@/lib/auth/next-path";
import { getProfile, getSessionUser } from "@/lib/auth/session";
import { NO_INDEX } from "@/lib/seo";
import { NameForm } from "./NameForm";
import { NameStepSignOut } from "./NameStepSignOut";

export const metadata: Metadata = { title: "What should we call you?", robots: NO_INDEX };

export default async function NamePage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  const profile = await getProfile();
  // A returning account already has a name. Don't ask again.
  if (profile?.display_name?.trim()) {
    const next = safeNextPath((await cookies()).get(NEXT_COOKIE)?.value);
    redirect(next ?? "/events");
  }

  return (
    <AuthShell>
      <AuthHeading>What should we call you?</AuthHeading>
      <NameForm />
      <NameStepSignOut />
    </AuthShell>
  );
}
