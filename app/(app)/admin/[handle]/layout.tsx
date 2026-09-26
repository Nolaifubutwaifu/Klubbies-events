import { AdminNav } from "@/components/AdminNav";
import { AppHeader } from "@/components/AppHeader";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { displayNameFor } from "@/lib/auth/display-name";
import { clubAddress } from "@/lib/env";
import { BILLING_LABEL, canWrite, type BillingStatus } from "@/lib/billing/status";
import { formatDate } from "@/lib/format";
import { signLogoMarks } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { clubToneStyle } from "@/lib/theme";

export default async function AdminLayout(props: LayoutProps<"/admin/[handle]">) {
  const { handle } = await props.params;
  const ctx = await requireAdminContext(handle);
  const supabase = await createClient();

  // The rail carries live counts, so it doubles as the state of the club.
  const [albums, members, removals, displayName] = await Promise.all([
    supabase.from("albums").select("id", { count: "exact", head: true }).eq("club_id", ctx.club.id),
    supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("club_id", ctx.club.id)
      .in("status", ["pending", "active", "grace"]),
    supabase
      .from("media_removal_requests")
      .select("id", { count: "exact", head: true })
      .eq("club_id", ctx.club.id)
      .eq("status", "open"),
    displayNameFor(ctx),
  ]);

  const logoUrl = ctx.club.logo_path
    ? ((await signLogoMarks(supabase, [ctx.club.logo_path])).get(ctx.club.logo_path) ?? null)
    : null;

  const status = ctx.club.billing_status as BillingStatus;
  const plan = canWrite(status)
    ? { line: "A$20 / month", hint: ctx.club.paid_at ? `Paid ${formatDate(ctx.club.paid_at)}` : BILLING_LABEL[status] }
    : { line: BILLING_LABEL[status], hint: "Activate to upload" };

  return (
    <div className="flex flex-1 flex-col" style={clubToneStyle(ctx.club.accent_colour)}>
      <AppHeader ctx={ctx} forceAdmin />
      <div className="flex flex-1 flex-col gap-2 px-4 pt-3 sm:px-6 lg:flex-row lg:items-start lg:gap-6 lg:px-6">
        <AdminNav
          handle={handle}
          clubName={ctx.club.name}
          clubAddress={clubAddress(handle)}
          accentColour={ctx.club.accent_colour}
          logoUrl={logoUrl}
          counts={{ albums: albums.count ?? 0, members: members.count ?? 0, removals: removals.count ?? 0 }}
          plan={plan}
          person={{ name: displayName, role: ctx.role?.name ?? "Admin" }}
        />
        <div className="min-w-0 flex-1">{props.children}</div>
      </div>
    </div>
  );
}
