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
      <main className="flex max-w-[760px] flex-col gap-6">
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
            <div className="flex flex-col gap-2">
              <span className="mono text-[14px] font-medium text-[color:var(--kb-brand-deep)]">Step 3 of 3</span>
              <h1 className="text-[28px] font-semibold tracking-[-0.02em] sm:text-[32px]">Choose your event&apos;s size</h1>
              <p className="m-0 text-[16px] text-[color:var(--kb-ink-2)]">
                {inApp
                  ? "Your event starts on Free. Tell us roughly how many guests to expect, then continue."
                  : "Pick a size by how many guests you expect. Small events are free, and every size gets every feature."}
              </p>
            </div>
            <SizeStep eventId={event.id} expected={event.expected_guests} offers={tierOffers(event)} inApp={inApp} payable={configured} />
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
    <main className="flex max-w-[760px] flex-col gap-6">
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

      <div className="flex flex-col gap-3 rounded-[10px] border border-[color:var(--kb-line)] bg-white p-5">
        <div className="flex items-center justify-between text-[14px]">
          <span className="font-semibold">
            {recommendedDone} of {state.recommended.length} done
          </span>
          <span className="mono text-[color:var(--kb-ink-3)]">{Math.round((recommendedDone / state.recommended.length) * 100)}%</span>
        </div>
        <div className="flex gap-1" aria-hidden>
          {state.recommended.map((step) => (
            <span key={step.key} className={`h-1.5 flex-1 rounded-[3px] ${step.done ? "bg-[color:var(--kb-ok)]" : "bg-[color:var(--kb-line)]"}`} />
          ))}
        </div>
        <details className="group">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-[14px] text-[color:var(--kb-ink-2)] [&::-webkit-details-marker]:hidden">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--kb-ok)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
            Done: details, who can get in and size
          </summary>
          <ul className="m-0 mt-2 flex list-none flex-col gap-3 p-0">
            {state.required.map((step) => (
              <li key={step.key} className="flex flex-wrap items-center gap-3">
                <span className="min-w-[180px] flex-1">
                  <span className="block text-[15px] font-medium">{step.title}</span>
                  <span className="block text-[14px] text-[color:var(--kb-ink-2)]">{step.hint}</span>
                </span>
                <Link href={step.key === "size" ? `/admin/${handle}/billing` : step.href} className="text-[14px] font-medium">
                  {step.cta}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </div>

      <ol className="m-0 flex list-none flex-col overflow-hidden rounded-[10px] border border-[color:var(--kb-line)] bg-white p-0">
        {state.recommended.map((step, index) => {
          const isNext = next?.key === step.key;
          return (
            <li key={step.key} className={`flex items-start gap-4 border-t border-[color:var(--kb-sand)] px-5 py-4 first:border-t-0 ${isNext ? "bg-[color:var(--kb-brand-tint)]/40" : ""}`}>
              <StepTick done={step.done} next={isNext} index={index + 1} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                {isNext ? <span className="text-[14px] font-semibold text-[color:var(--kb-brand-deep)]">Next</span> : null}
                <span className={`text-[16px] font-semibold ${step.done ? "text-[color:var(--kb-ink-2)]" : ""}`}>{step.title}</span>
                <span className="text-[14px] text-[color:var(--kb-ink-2)]">{step.hint}</span>
                {isNext ? (
                  <span className="mt-2">
                    <Link href={step.href} className="btn btn-primary no-underline">
                      {step.cta}
                    </Link>
                  </span>
                ) : null}
              </span>
              {isNext ? null : (
                <Link href={step.href} className="mt-1 flex-none text-[14px] font-medium">
                  {step.cta}
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      <Link href={`/admin/${handle}`} className="kb-link self-start">
        Go to the overview
      </Link>
    </main>
  );
}
