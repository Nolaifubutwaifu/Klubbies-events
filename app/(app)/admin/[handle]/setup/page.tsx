import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { canWrite } from "@/lib/billing/status";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set up your event" };

type Step = {
  key: string;
  title: string;
  hint: string;
  done: boolean;
  href: string;
  cta: string;
};

function Tick({ done, index }: { done: boolean; index: number }) {
  return (
    <span
      className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[14px] font-semibold"
      style={done ? { background: "var(--kb-ember)", color: "#fff" } : { background: "var(--kb-sand)", color: "var(--kb-ink-2)" }}
      aria-hidden
    >
      {done ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      ) : (
        index
      )}
    </span>
  );
}

/**
 * The setup checklist reads the event's real state, so it can be left and
 * come back to rather than trapping the organiser in a wizard.
 */
export default async function SetupPage(props: PageProps<"/admin/[handle]/setup">) {
  const { handle } = await props.params;
  const ctx = await requireAdminContext(handle);
  const supabase = await createClient();
  const inApp = await isNativeAppRequest();
  const { event } = ctx;

  const [{ count: onList }, { count: albums }, { count: links }, { count: photographerAccounts }] = await Promise.all([
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("event_id", event.id).in("status", ["pending", "active"]),
    supabase.from("albums").select("id", { count: "exact", head: true }).eq("event_id", event.id),
    supabase.from("album_guest_links").select("id", { count: "exact", head: true }).eq("event_id", event.id),
    supabase
      .from("memberships")
      .select("id, event_roles!inner(key)", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("event_roles.key", "photographer"),
  ]);

  const guestList = event.access_mode === "guest_list";
  const steps: Step[] = [
    {
      key: "details",
      title: "Event details",
      hint: event.starts_on ? "Name, dates and venue are set" : "Add the date and venue attendees will see",
      done: Boolean(event.starts_on),
      href: `/admin/${handle}/settings`,
      cta: "Edit details",
    },
    {
      key: "pay",
      title: inApp ? "Event status" : "Activate the event",
      hint: canWrite(event.billing_status) ? "Paid" : inApp ? "Not active yet" : "One payment unlocks uploading and attendees",
      done: canWrite(event.billing_status),
      href: `/admin/${handle}/billing`,
      cta: inApp ? "Status" : "Activate",
    },
    {
      key: "brand",
      title: "Logo and brand colour",
      hint: event.logo_path ? "Your logo is on every attendee screen" : "Attendees should see your brand, not ours",
      done: Boolean(event.logo_path),
      href: `/admin/${handle}/settings`,
      cta: event.logo_path ? "Change it" : "Add your logo",
    },
    {
      key: "album",
      title: "Create an album",
      hint: (albums ?? 0) > 0 ? `${albums} so far` : "One per part of the event: keynote, drinks, headshots",
      done: (albums ?? 0) > 0,
      href: `/admin/${handle}/upload`,
      cta: "New album",
    },
    {
      key: "photographer",
      title: "Add your photographers",
      hint:
        (links ?? 0) + (photographerAccounts ?? 0) > 0
          ? "Upload links sent"
          : "Each gets an upload link. No account needed",
      done: (links ?? 0) + (photographerAccounts ?? 0) > 0,
      href: `/admin/${handle}/photographers`,
      cta: "Add photographer",
    },
    guestList
      ? {
          key: "list",
          title: "Import the guest list",
          hint: (onList ?? 0) > 1 ? `${(onList ?? 0).toLocaleString("en-AU")} on the list` : "Only people on it can get in",
          done: (onList ?? 0) > 1,
          href: `/admin/${handle}/attendees`,
          cta: "Import",
        }
      : {
          key: "share",
          title: "Get the QR code",
          hint: "For the closing slide, table cards and the follow-up email",
          done: false,
          href: `/admin/${handle}/share`,
          cta: "Open share kit",
        },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  return (
    <main className="flex max-w-[860px] flex-col gap-6 pb-12 pt-2">
      <PageTitle kicker={event.name} title="Set up your event">
        About ten minutes. Come back any time: this list reads what&apos;s actually done.
      </PageTitle>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[14px]">
          <span className="font-medium">
            {doneCount} of {steps.length} done
          </span>
          {next ? <span className="text-[color:var(--ink-55)]">Next: {next.title}</span> : <span>All set</span>}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--kb-sand)]">
          <div className="h-full rounded-full bg-[color:var(--kb-ember)]" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
      </div>

      <ol className="soft-card m-0 flex list-none flex-col p-0">
        {steps.map((step, index) => (
          <li key={step.key} className={`flex flex-wrap items-center gap-4 p-4 ${index > 0 ? "border-t border-[color:var(--kb-line)]" : ""}`}>
            <Tick done={step.done} index={index + 1} />
            <span className="min-w-[200px] flex-1">
              <span className="block text-[15px] font-medium">{step.title}</span>
              <span className="block text-[14px] text-[color:var(--ink-70)]">{step.hint}</span>
            </span>
            <Link
              href={step.href}
              className={`btn btn-sm no-underline ${next?.key === step.key ? "btn-primary" : "btn-secondary"}`}
            >
              {step.cta}
            </Link>
          </li>
        ))}
      </ol>

      <Link href={`/admin/${handle}`} className="kb-link self-start">
        Go to the overview
      </Link>
    </main>
  );
}
