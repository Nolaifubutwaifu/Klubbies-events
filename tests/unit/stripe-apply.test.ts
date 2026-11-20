import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A tiny stand-in for the service-role client: one event, the purchases
// table's unique session id, and the two RPCs the apply path calls.
const db = {
  event: { plan: "free", paid_at: null as string | null, billing_status: "free" },
  purchases: new Set<string>(),
  failNextPlan: false,
  rpcCalls: [] as { name: string; args: Record<string, unknown> }[],
};

function from(table: string) {
  let op: "select" | "insert" | "update" = "select";
  let payload: Record<string, unknown> = {};
  const run = () => {
    if (table === "event_purchases" && op === "insert") {
      const id = String(payload.stripe_session_id);
      if (db.purchases.has(id)) return { data: null, error: { code: "23505" } };
      db.purchases.add(id);
      return { data: null, error: null };
    }
    if (table === "events" && op === "update") Object.assign(db.event, payload);
    return { data: null, error: null };
  };
  const chain = {
    insert: (row: Record<string, unknown>) => ((op = "insert"), (payload = row), chain),
    update: (values: Record<string, unknown>) => ((op = "update"), (payload = values), chain),
    select: () => chain,
    eq: () => chain,
    neq: () => chain,
    maybeSingle: async () => ({ data: table === "events" ? { ...db.event } : null, error: null }),
    then: (resolve: (value: ReturnType<typeof run>) => unknown) => resolve(run()),
  };
  return chain;
}

async function rpc(name: string, args: Record<string, unknown>) {
  db.rpcCalls.push({ name, args });
  if (name === "apply_event_plan") {
    if (db.failNextPlan) {
      db.failNextPlan = false;
      return { error: new Error("statement timeout") };
    }
    db.event.plan = String(args.p_plan);
  }
  return { error: null };
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from, rpc }) }));
vi.mock("@/lib/billing/notices", () => ({ checkPlanNotices: async () => undefined }));

const { applyCheckoutSession } = await import("@/lib/billing/stripe");

function session(kind: "tier" | "keep_year"): Stripe.Checkout.Session {
  return {
    id: `cs_test_${kind}`,
    status: "complete",
    payment_status: "paid",
    amount_total: kind === "tier" ? 14900 : 2900,
    currency: "aud",
    customer: "cus_1",
    discounts: [],
    metadata: { event_id: "event-1", kind, from_plan: "free", to_plan: "medium", rate: "standard", late: "0", list_amount_cents: "14900" },
  } as unknown as Stripe.Checkout.Session;
}

beforeEach(() => {
  db.event = { plan: "free", paid_at: null, billing_status: "free" };
  db.purchases.clear();
  db.failNextPlan = false;
  db.rpcCalls = [];
});

describe("applying a paid Checkout session", () => {
  it("still moves the plan when the retry finds the purchase already recorded", async () => {
    db.failNextPlan = true;
    await expect(applyCheckoutSession(session("tier"))).rejects.toThrow("statement timeout");
    expect(db.purchases.size).toBe(1);
    expect(db.event.plan).toBe("free");

    // Stripe's retry, or the organiser coming back from Checkout.
    await applyCheckoutSession(session("tier"));
    expect(db.event.plan).toBe("medium");
    expect(db.event.billing_status).toBe("active");
    expect(db.purchases.size).toBe(1);
  });

  it("never moves the plan down for a late session for a smaller tier", async () => {
    db.event.plan = "large";
    await applyCheckoutSession(session("tier"));
    expect(db.event.plan).toBe("large");
    expect(db.rpcCalls.some((call) => call.name === "apply_event_plan")).toBe(false);
  });

  it("adds a year through the one-transaction RPC, keyed by the session", async () => {
    await applyCheckoutSession(session("keep_year"));
    expect(db.rpcCalls).toEqual([
      {
        name: "apply_keep_year",
        args: {
          p_event_id: "event-1",
          p_session_id: "cs_test_keep_year",
          p_amount_cents: 2900,
          p_list_amount_cents: 2900,
          p_currency: "aud",
          p_customer_id: "cus_1",
        },
      },
    ]);
  });
});
