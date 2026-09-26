import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthHeading, AuthNote, AuthShell, type AuthClub } from "@/components/AuthShell";
import { getSessionUser } from "@/lib/auth/session";
import { BUCKET } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Log in" };

/**
 * The club someone followed a link for: its name and logo only. No album
 * counts, no cover photo: this page is public, and the product's promise is
 * that nothing about a club's photos shows to anyone off the list.
 */
async function clubPreview(handle: string | undefined): Promise<AuthClub | null> {
  if (!handle || !/^[a-z0-9_]{1,48}$/i.test(handle)) return null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("clubs")
      .select("name, organisation, handle, logo_path")
      .eq("handle", handle.toLowerCase())
      .eq("status", "active")
      .maybeSingle();
    if (!data) return null;
    const logoUrl = data.logo_path
      ? ((await admin.storage.from(BUCKET).createSignedUrl(data.logo_path, 10 * 60)).data?.signedUrl ?? null)
      : null;
    return { name: data.name, handle: data.handle, organisation: data.organisation, logoUrl };
  } catch (error) {
    console.error("club preview failed", error);
    return null;
  }
}

export default async function SignInPage(props: PageProps<"/signin">) {
  const params = await props.searchParams;
  const clubHandle = typeof params.club === "string" ? params.club : undefined;
  const user = await getSessionUser();
  if (user) redirect(clubHandle ? `/c/${clubHandle}` : "/clubs");

  const club = await clubPreview(clubHandle);

  return (
    <AuthShell
      club={club}
      topLink={
        <>
          <span className="hidden sm:inline">Running a club? </span>
          <Link href="/start" className="font-bold">
            Start your club
          </Link>
        </>
      }
    >
      <AuthHeading chip={club ? `${club.name} members` : undefined}>Log in</AuthHeading>
      <p className="kb-lead mt-3 !text-[17px]">
        Use the email your committee has on the member list. We&rsquo;ll send you a code, so there&rsquo;s no password to
        remember.
      </p>

      <div className="mt-7">
        <SignInForm flow="member" club={club?.handle} />
      </div>

      <AuthNote>Not on the list yet? Ask your committee to add your email, then come back here.</AuthNote>
    </AuthShell>
  );
}
