import "server-only";
import { notFound } from "next/navigation";
import { getProfile, requireUser } from "@/lib/auth/session";
import { HEARD_FROM } from "@/lib/attribution";
import { planName } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCost, type CostEstimate } from "./cost";

/**
 * The private usage view (pricing handoff §5.8): one row per event, for Max.
 * Open to platform super admins and to addresses in OPS_EMAILS; everyone else
 * gets a not found page.
 */
export async function requireOps(): Promise<void> {
  const user = await requireUser("/ops/usage");
  const profile = await getProfile();
  const allowed = (process.env.OPS_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (profile?.is_super_admin || (user.email && allowed.includes(user.email.toLowerCase()))) return;
  notFound();
}

export type UsageRow = {
  eventId: string;
  handle: string;
  name: string;
  createdAt: string;
  endsOn: string | null;
  plan: string;
  rate: string | null;
  paidAud: number;
  source: string;
  expectedGuests: number | null;
  guestsJoined: number;
  joinRate: number | null;
  selfieRate: number | null;
  downloadRate: number | null;
  photos: number;
  videoMinutes: number;
  storageGb: number;
  backupGb: number;
  faceCalls: number;
  downloads: number;
  zips: number;
  /** Days from the event's last day to its first published album. */
  daysToFirstPhotos: number | null;
  cost: CostEstimate;
  deleted: boolean;
};

const GB = 1024 ** 3;

function share(part: number, whole: number | null | undefined): number | null {
  return whole ? Math.round((part / whole) * 1000) / 1000 : null;
}

function sourceOf(e: { source: string | null; club_code: string | null; heard_from: string | null }, partnerCode: string | null): string {
  const heard = HEARD_FROM.find((o) => o.value === e.heard_from)?.label;
  return [e.source, e.club_code, partnerCode ? `code ${partnerCode}` : null, heard ? `said: ${heard}` : null].filter(Boolean).join(" · ") || "unknown";
}

export async function usageReport(): Promise<UsageRow[]> {
  const admin = createAdminClient();
  const [{ data: events }, { data: usage }, { data: purchases }] = await Promise.all([
    admin
      .from("events")
      .select("id, handle, name, created_at, ends_on, starts_on, plan, plan_rate, expected_guests, source, club_code, heard_from, deleted_at")
      .order("created_at", { ascending: false })
      .limit(2000),
    admin.from("event_usage").select("*").limit(5000),
    admin.from("event_purchases").select("event_id, amount_cents, promotion_code").limit(10000),
  ]);
  const usageBy = new Map((usage ?? []).map((u) => [u.event_id, u]));
  const paidBy = new Map<string, number>();
  const codeBy = new Map<string, string>();
  for (const p of purchases ?? []) {
    paidBy.set(p.event_id, (paidBy.get(p.event_id) ?? 0) + p.amount_cents / 100);
    if (p.promotion_code) codeBy.set(p.event_id, p.promotion_code);
  }

  return (events ?? []).map((e) => {
    const u = usageBy.get(e.id);
    const paidAud = paidBy.get(e.id) ?? 0;
    const lastDay = e.ends_on ?? e.starts_on;
    const firstPublished = u?.first_published_at ?? null;
    return {
      eventId: e.id,
      handle: e.handle,
      name: e.name,
      createdAt: e.created_at,
      endsOn: lastDay,
      plan: planName(e.plan),
      rate: e.plan_rate,
      paidAud,
      source: sourceOf(e, codeBy.get(e.id) ?? null),
      expectedGuests: e.expected_guests,
      guestsJoined: u?.guests_joined ?? 0,
      joinRate: share(u?.guests_joined ?? 0, e.expected_guests),
      selfieRate: share(u?.selfies ?? 0, u?.guests_joined),
      downloadRate: share(u?.guests_downloaded ?? 0, u?.guests_joined),
      photos: u?.photos ?? 0,
      videoMinutes: Math.round(Number(u?.video_seconds ?? 0) / 6) / 10,
      storageGb: Math.round(((u?.original_bytes ?? 0) / GB) * 100) / 100,
      backupGb: Math.round(((u?.backed_up_bytes ?? 0) / GB) * 100) / 100,
      faceCalls: u?.face_calls ?? 0,
      downloads: u?.downloads ?? 0,
      zips: u?.zips ?? 0,
      daysToFirstPhotos:
        lastDay && firstPublished
          ? Math.round((new Date(firstPublished).getTime() - new Date(`${lastDay}T23:59:59+10:00`).getTime()) / 864e5 * 10) / 10
          : null,
      cost: estimateCost({
        originalBytes: u?.original_bytes ?? 0,
        backedUpBytes: u?.backed_up_bytes ?? 0,
        faceCalls: u?.face_calls ?? 0,
        views: u?.views ?? 0,
        paidAud,
      }),
      deleted: Boolean(e.deleted_at),
    };
  });
}

/** The same rows as a spreadsheet. */
export function usageCsv(rows: UsageRow[]): string {
  const header = [
    "event", "handle", "created", "last day", "size", "rate", "paid A$", "source", "expected guests", "guests joined",
    "join rate", "selfie rate", "download rate", "photos", "video minutes", "storage GB", "R2 GB", "face calls",
    "downloads", "zips", "days to first photos", "storage A$", "R2 A$", "face A$", "egress A$", "Stripe A$",
    "est. cost A$", "margin", "in bin",
  ];
  const cell = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = rows.map((r) =>
    [
      r.name, r.handle, r.createdAt.slice(0, 10), r.endsOn, r.plan, r.rate, r.paidAud, r.source, r.expectedGuests, r.guestsJoined,
      r.joinRate, r.selfieRate, r.downloadRate, r.photos, r.videoMinutes, r.storageGb, r.backupGb, r.faceCalls,
      r.downloads, r.zips, r.daysToFirstPhotos, r.cost.storageAud, r.cost.backupAud, r.cost.faceAud, r.cost.egressAud,
      r.cost.stripeAud, r.cost.totalAud, r.cost.margin, r.deleted ? "yes" : "",
    ]
      .map(cell)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
