import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { BILLING_LABEL, canWrite, type BillingStatus } from "@/lib/billing/status";
import { clubAddress } from "@/lib/env";
import { backfillProgress } from "@/lib/faces/backfill";
import { facesConfigured } from "@/lib/faces/client";
import { clubFaceState } from "@/lib/faces/collections";
import { formatLongDate } from "@/lib/format";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { FaceRecognition } from "./FaceRecognition";
import { LogoUploader } from "./LogoUploader";
import { PrivacySwitches } from "./PrivacySwitches";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Billing & settings" };

export default async function SettingsPage(props: PageProps<"/admin/[handle]/settings">) {
  const { handle } = await props.params;
  const ctx = await requireAdminContext(handle);
  const { club } = ctx;
  const supabase = await createClient();
  const logoUrl = club.logo_path ? ((await signPaths(supabase, [club.logo_path], SIGNED_URL_TTL.display)).get(club.logo_path) ?? null) : null;

  const [faceState, faceBackfill, { count: enrolledCount }] = await Promise.all([
    clubFaceState(club.id),
    backfillProgress(club.id),
    supabase.from("member_face_profiles").select("id", { count: "exact", head: true }).eq("club_id", club.id),
  ]);

  const status = club.billing_status as BillingStatus;
  const active = canWrite(status);

  return (
    <main className="flex flex-col gap-7 px-4 py-8 sm:px-6">
      <PageTitle kicker={club.name} title="Billing &amp; settings">
        One plan, one card, and the handful of switches that matter.
      </PageTitle>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <div className="flex flex-col gap-7">
          <section className="flex flex-col gap-4">
            <h2 className="soft-display text-[19px]">Club details</h2>
            <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              <SettingsForm
                clubId={club.id}
                name={club.name}
                organisation={club.organisation}
                description={club.description}
                accentColour={club.accent_colour}
              />
              <div className="flex flex-col gap-4">
                <span className="text-[14px] font-semibold">Club mark</span>
                <span className="text-[14px] leading-normal text-[color:var(--ink-70)]">
                  Shown next to the club name in the header, and on the club switcher.
                </span>
                <LogoUploader clubId={club.id} logoUrl={logoUrl} />
                <div className="soft-card bg-surface p-4">
                  <div className="label-caps">Club address</div>
                  {/* Breaks after a slash, never inside "uq_vb". */}
                  <div className="mt-2 break-words soft-display text-[18px]">
                    {clubAddress(club.handle)
                      .split("/")
                      .map((part, i, all) => (
                        <span key={i}>
                          {part}
                          {i < all.length - 1 ? (
                            <>
                              /<wbr />
                            </>
                          ) : null}
                        </span>
                      ))}
                  </div>
                  <p className="mt-2 text-[14px] leading-normal text-[color:var(--ink-70)]">
                    Share this link with members. It never changes, so links in group chats keep working.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="soft-display text-[19px]">Privacy</h2>
            <PrivacySwitches
              clubId={club.id}
              initial={{
                allow_removal_requests: club.allow_removal_requests,
                grace_period_enabled: club.grace_period_enabled,
              }}
            />
            <p className="m-0 max-w-[60ch] text-[14px] text-[color:var(--ink-70)]">
              Who can add photos is set per album, when you create it. Nothing here is ever public: every album needs a
              signed-in member on your list.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="soft-display text-[19px]">Find yourself in photos</h2>
            <FaceRecognition
              clubId={club.id}
              clubName={club.name}
              configured={facesConfigured()}
              enabled={Boolean(faceState?.enabled)}
              enrolledCount={enrolledCount ?? 0}
              backfill={faceBackfill}
            />
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="soft-card flex flex-col gap-3 p-5">
            <span className={active ? "soft-chip self-start" : "soft-chip soft-chip-muted self-start"}>
              {BILLING_LABEL[status]}
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="soft-display text-[36px] leading-none">A$20</span>
              <span className="text-[14px] text-[color:var(--ink-70)]">/ month</span>
            </span>
            <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
              {active
                ? `${club.paid_at ? `Paid ${formatLongDate(club.paid_at)}. ` : ""}Unlimited members, albums and storage.`
                : "Nothing is charged until you activate. Activating unlocks adding members and uploading."}
            </p>
            <Link href={`/admin/${handle}/billing`} className={`btn self-start ${active ? "btn-secondary" : "btn-primary"}`}>
              {active ? "Card and receipts" : "Activate the club"}
            </Link>
          </section>

          <section className="rounded-[var(--soft-r)] bg-[color:var(--kb-sand)] p-5">
            <span className="block text-[14px] font-bold">Splitting it with the committee?</span>
            <p className="m-0 mt-1 text-[14px]">
              A$20 across four people is A$5 each, once a month. We send one receipt you can forward.
            </p>
          </section>

          <section className="soft-card flex flex-col gap-2 p-5">
            <span className="text-[14px] font-bold">If you cancel</span>
            <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
              Every album stays readable and downloadable for your members. You just can&apos;t add new ones until
              someone picks it back up.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
