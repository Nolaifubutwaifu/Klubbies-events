import type { Metadata } from "next";
import { BillingGate } from "@/components/BillingGate";
import { PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { canWrite } from "@/lib/billing/status";
import { isTier, planName } from "@/lib/billing/plans";
import { getPlanUsage } from "@/lib/billing/usage";
import { formatDate, isoToBrisbaneInput } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AddMemberForm } from "./AddMemberForm";
import { MemberTable, type MemberRow } from "./MemberTable";
import { RosterImport } from "./RosterImport";
import { AccessModeCards, AttendeeButtons } from "./AttendeeTools";

export const metadata: Metadata = { title: "Attendees" };

const MAX_ROWS = 2000;

export default async function AttendeesPage(props: PageProps<"/admin/[handle]/attendees">) {
  const { handle } = await props.params;
  const ctx = await requireAdminContext(handle);
  const supabase = await createClient();
  const { event } = ctx;
  const writable = canWrite(event);

  const [{ data: members }, { data: roles }, imports, { data: findable }] = await Promise.all([
    supabase
      .from("memberships")
      .select(
        "id, roster_name, roster_email, claimed_name, name_mismatch, status, role, role_id, first_seen_at, paused_at, invited_at, created_at, user_id, event_roles(id, name, manage_event)",
      )
      .eq("event_id", event.id)
      .order("roster_name", { ascending: true })
      .limit(MAX_ROWS),
    supabase.from("event_roles").select("id, name, manage_event").eq("event_id", event.id).order("sort_order"),
    supabase
      .from("roster_imports")
      .select("id, filename, added_count, matched_count, error_count, imported_at")
      .eq("event_id", event.id)
      .eq("status", "committed")
      .order("imported_at", { ascending: false })
      .limit(5),
    // Who has added a selfie, so the organiser can see the feature is used.
    // Read with the service role after the organiser check: a yes or no per
    // attendee, never the selfie or the matches.
    createAdminClient().from("member_face_profiles").select("user_id").eq("event_id", event.id).eq("status", "ready"),
  ]);

  const findableUsers = new Set((findable ?? []).map((row) => row.user_id));
  const rows: MemberRow[] = (members ?? []).map((m) => ({
    id: m.id,
    name: m.claimed_name ?? m.roster_name,
    email: m.roster_email,
    claimedName: m.claimed_name,
    nameMismatch: m.name_mismatch,
    status: m.status,
    roleId: m.role_id,
    roleName: m.event_roles?.name ?? (m.role === "event_admin" ? "Organiser" : "Attendee"),
    isAdminRole: Boolean(m.event_roles?.manage_event) || m.role === "event_admin",
    since: m.invited_at ?? m.created_at,
    firstSeenAt: m.first_seen_at,
    paused: Boolean(m.paused_at),
    userId: m.user_id,
    findable: m.user_id ? findableUsers.has(m.user_id) : false,
  }));

  const live = rows.filter((m) => m.status !== "revoked");
  const joined = live.filter((m) => m.firstSeenAt).length;
  const linkMode = event.access_mode === "link";

  const usage = await getPlanUsage(event.id);
  const planShort = isTier(event.plan) ? planName(event.plan) : null;

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle kicker={event.name} title="Attendees">
          <span className="mono">{joined.toLocaleString("en-AU")}</span> joined
          {usage?.guestLimit && planShort ? (
            <>
              {" "}
              of <span className="mono">{usage.guestLimit.toLocaleString("en-AU")}</span> on {planShort}
            </>
          ) : !linkMode ? (
            <>
              {" "}
              of <span className="mono">{live.length.toLocaleString("en-AU")}</span> on the list
            </>
          ) : null}{" "}
          · <span className="mono">{findableUsers.size.toLocaleString("en-AU")}</span> found their photos
        </PageTitle>
        {writable ? (
          <AttendeeButtons importPanel={<RosterImport eventId={event.id} />} addPanel={<AddMemberForm eventId={event.id} />} />
        ) : null}
      </div>

      {writable ? null : <BillingGate handle={handle} action="add attendees" deletedAt={ctx.event.photos_deleted_at} />}

      <AccessModeCards
        eventId={event.id}
        mode={linkMode ? "link" : "guest_list"}
        endsOn={event.access_ends_at ? isoToBrisbaneInput(event.access_ends_at).slice(0, 10) : ""}
      />

      <MemberTable
        eventId={event.id}
        currentUserId={ctx.userId}
        members={rows}
        roles={roles ?? []}
        canManageRoles={ctx.perms.manage_members}
      />

      {rows.length >= MAX_ROWS ? (
        <p className="text-[14px] text-[color:var(--ink-70)]">
          Showing the first {MAX_ROWS.toLocaleString("en-AU")} people. Search to narrow the list.
        </p>
      ) : null}

      {imports.data?.length ? (
        <details className="flex flex-col gap-3 rounded-[10px] border border-[color:var(--kb-line)] bg-white p-5">
          <summary className="min-h-[44px] cursor-pointer content-center text-[16px] font-semibold">Import history</summary>
          <table className="table">
            <thead>
              <tr>
                <th>File</th>
                <th>Added</th>
                <th>Already there</th>
                <th>Problems</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {imports.data.map((i) => (
                <tr key={i.id}>
                  <td>{i.filename}</td>
                  <td>{i.added_count}</td>
                  <td>{i.matched_count}</td>
                  <td>{i.error_count}</td>
                  <td className="text-[color:var(--ink-70)]">{formatDate(i.imported_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
    </main>
  );
}
