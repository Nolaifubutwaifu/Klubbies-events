import type { Metadata } from "next";
import Link from "next/link";
import { SetupSteps, StepTick } from "@/components/SetupSteps";
import { PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { CLUB_CODES } from "@/lib/billing/club-codes";
import { planName, tierOffers } from "@/lib/billing/plans";
import { stripeConfigured, syncReturnedSession } from "@/lib/billing/stripe";
import { setupState } from "@/lib/events/setup";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { ClubCodeForm } from "../billing/BillingForms";
import { SizeStep } from "./SizeStep";

export const metadata: Metadata = { title: "Set up your event" };

/**
 * Setting up an event, in two parts. First the three steps every event needs
 * (details and who can get in come from the create form, then the size here);
 * until they're done the organiser menu stays hidden. Then the recommended
 * steps, one at a time, with the next one highlighted. Both read the event's
 * real state, so leaving and coming back picks up where things are.
 */
export default async function SetupPage(props: PageProps<"/admin/[handle]/setup">) {
  const { handle } = await props.params;
  const search = await props.searchParams;
  let ctx = await requireAdminContext(handle);
  const inApp = await isNativeAppRequest();
  const configured = stripeConfigured();

  // Back from Stripe's Checkout page: apply the payment now rather than
  // waiting for the webhook, so the next screen already shows the new size.
  let justPaid = false;
  if (configured && typeof search.session_id === "string") {
    justPaid = await syncReturnedSession(search.session_id, ctx.event.id).catch((error: unknown) => {
      console.error("session sync failed", error);
      return false;
    });
    if (justPaid) ctx = await requireAdminContext(handle);
  }
  const { event } = ctx;
  const state = await setupState(event, inApp);

  if (!state.requiredDone) {
    const detailsDone = state.required[0].done;
    return (
      <main className="flex max-w-[760px] flex-col gap-6 pb-12 pt-2">
        <SetupSteps
          steps={state.required.map((step) => ({
            label: step.title,
            state: step.done ? "done" : step.key === state.next?.key ? "current" : "todo",
          }))}
        />
        {search.canceled ? <div className="notice">Checkout was cancelled. Nothing was charged.</div> : null}
        {!detailsDone ? (
          <>
            <PageTitle kicker={event.name} title="Add your event's date">
              Attendees see the date and venue on every screen.
            </PageTitle>
            <Link href={`/admin/${handle}/settings`} className="btn btn-primary self-start no-underline">
              Add details
            </Link>
          </>
        ) : (
          <>
            <PageTitle kicker={`${event.name} · Step 3 of 3`} title="Choose your event's size">
              {inApp
                ? "Your event starts on Free. Tell us roughly how many guests to expect, then continue."
                : "Pick a size by how many guests you expect. Small events are free."}
            </PageTitle>
            <section className="soft-card p-5 sm:p-6">
              <SizeStep eventId={event.id} expected={event.expected_guests} offers={tierOffers(event)} inApp={inApp} payable={configured} />
            </section>
            {!inApp && !event.plan_rate ? (
              <ClubCodeForm
                eventId={event.id}
                code={event.club_code}
                campus={event.club_code ? (CLUB_CODES[event.club_code] ?? null) : null}
              />
            ) : null}
          </>
        )}
      </main>
    );
  }

  const recommendedDone = state.recommended.filter((step) => step.done).length;
  const next = state.recommended.find((step) => !step.done) ?? null;

  return (
    <main className="flex max-w-[760px] flex-col gap-6 pb-12 pt-2">
      {justPaid ? (
        <div className="kb-ok-note" role="status">
          Paid. {event.name} is now {planName(event.plan)}.
        </div>
      ) : null}
      <PageTitle kicker={event.name} title={next ? "Get your event ready" : "Your event is ready"}>
        {next
          ? "The essentials are done. These make the event good, in the order worth doing them."
          : "Everything's in place. Photos will appear for attendees as soon as albums are published."}
      </PageTitle>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[14px]">
          <span className="font-medium">
            {recommendedDone} of {state.recommended.length} done
          </span>
          {next ? <span className="text-[color:var(--kb-ink-2)]">Next: {next.title}</span> : <span>All done</span>}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[color:var(--kb-sand)]">
          <div className="h-full rounded-full bg-[color:var(--kb-ok)]" style={{ width: `${(recommendedDone / state.recommended.length) * 100}%` }} />
        </div>
      </div>

      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {state.recommended.map((step, index) => {
          const isNext = next?.key === step.key;
          return (
            <li
              key={step.key}
              className={`flex flex-wrap items-center gap-4 rounded-[var(--kb-r-card)] border bg-[color:var(--kb-white)] p-4 ${
                isNext ? "border-[color:var(--kb-brand)] shadow-[0_0_0_1px_var(--kb-brand)]" : "border-[color:var(--kb-line)]"
              }`}
            >
              <StepTick done={step.done} next={isNext} index={index + 1} />
              <span className="min-w-[200px] flex-1">
                <span className={`block text-[15px] font-medium ${step.done ? "text-[color:var(--kb-ink-2)]" : ""}`}>{step.title}</span>
                <span className="block text-[14px] text-[color:var(--kb-ink-2)]">{step.hint}</span>
              </span>
              <Link href={step.href} className={`btn btn-sm no-underline ${isNext ? "btn-primary" : "btn-secondary"}`}>
                {step.cta}
              </Link>
            </li>
          );
        })}
      </ol>

      <details className="rounded-[var(--kb-r-card)] border border-[color:var(--kb-line)] bg-[color:var(--kb-white)] p-4">
        <summary className="cursor-pointer text-[15px] font-medium">Done: details, who can get in and size</summary>
        <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
          {state.required.map((step) => (
            <li key={step.key} className="flex flex-wrap items-center gap-3">
              <StepTick done next={false} index={0} />
              <span className="min-w-[180px] flex-1">
                <span className="block text-[15px] font-medium">{step.title}</span>
                <span className="block text-[14px] text-[color:var(--kb-ink-2)]">{step.hint}</span>
              </span>
              <Link href={step.key === "size" ? `/admin/${handle}/billing` : step.href} className="btn btn-sm btn-secondary no-underline">
                {step.cta}
              </Link>
            </li>
          ))}
        </ul>
      </details>

      <Link href={`/admin/${handle}`} className="kb-link self-start">
        Go to the overview
      </Link>
    </main>
  );
}
