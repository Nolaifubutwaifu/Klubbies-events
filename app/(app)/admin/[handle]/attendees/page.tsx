import type { Metadata } from "next";
import Link from "next/link";
import { BillingGate } from "@/components/BillingGate";
import { PageTitle, Stat } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { canWrite } from "@/lib/billing/status";
import { formatDate } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AddMemberForm } from "./AddMemberForm";
import { MemberTable, type MemberRow } from "./MemberTable";
import { RosterImport } from "./RosterImport";

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

  return (
    <main className="flex flex-col gap-6 pb-12 pt-2">
      <PageTitle kicker={event.name} title="Attendees">
        {linkMode
          ? "Anyone with the event link who confirms their email joins and appears here. Importing a guest list is optional."
          : "Guest list only: people on this list can sign in, nobody else. Import the list from your ticketing tool."}{" "}
        <Link href={`/admin/${handle}/settings#access`}>Change who can get in</Link>
      </PageTitle>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {writable ? (
          <>
            <RosterImport eventId={event.id} />
            <AddMemberForm eventId={event.id} />
          </>
        ) : (
          <BillingGate handle={handle} action="add attendees" deletedAt={ctx.event.photos_deleted_at} />
        )}
        <div className="flex flex-col gap-3">
          <Stat
            value={joined.toLocaleString("en-AU")}
            label="Joined"
            hint={linkMode ? "through the link or the list" : `of ${live.length.toLocaleString("en-AU")} on the list`}
            tone={joined > 0 ? "good" : "plain"}
          />
          <Stat value={findableUsers.size.toLocaleString("en-AU")} label="Added a selfie" hint="to find their photos" />
        </div>
      </div>

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
        <details className="soft-card flex flex-col gap-3 p-5">
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
