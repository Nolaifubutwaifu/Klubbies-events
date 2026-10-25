import { beforeEach, describe, expect, it, vi } from "vitest";
import { NAME_STEP_PATH } from "@/lib/auth/sign-in-name";

const USER = "11111111-1111-4111-8111-111111111111";
const EVENT = "22222222-2222-4222-8222-222222222222";

type Row = Record<string, unknown>;
const tables = vi.hoisted(() => ({ current: {} as Record<string, Row[]> }));

function valueAt(row: Row, key: string): unknown {
  return key.split(".").reduce<unknown>((obj, part) => (obj && typeof obj === "object" ? (obj as Row)[part] : undefined), row);
}

function unnamed(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function matches(row: Row, filters: { op: string; col: string; val: unknown }[]) {
  return filters.every((filter) => {
    const current = valueAt(row, filter.col);
    if (filter.op === "eq") return current === filter.val;
    if (filter.op === "in") return Array.isArray(filter.val) && filter.val.includes(current);
    if (filter.op === "is") return filter.val === null ? current == null : current === filter.val;
    if (filter.op === "unnamed") return unnamed(current);
    return true;
  });
}

function from(name: string) {
  const filters: { op: string; col: string; val: unknown }[] = [];
  const rows = () => (tables.current[name] ??= []);
  const found = () => rows().filter((row) => matches(row, filters));
  const builder = {
    select() {
      return builder;
    },
    eq(col: string, val: unknown) {
      filters.push({ op: "eq", col, val });
      return builder;
    },
    in(col: string, val: unknown) {
      filters.push({ op: "in", col, val });
      return builder;
    },
    is(col: string, val: unknown) {
      filters.push({ op: "is", col, val });
      return builder;
    },
    maybeSingle: async () => ({ data: found()[0] ?? null, error: null }),
    insert: async (row: Row) => {
      if (name === "pending_sign_ins" && rows().some((existing) => existing.email === row.email)) {
        return { data: null, error: { code: "23505", message: "duplicate key" } };
      }
      rows().push({ id: crypto.randomUUID(), ...row });
      return { data: null, error: null };
    },
    upsert: async (row: Row) => {
      const index = rows().findIndex((existing) => existing.email === row.email);
      if (index >= 0) rows()[index] = { ...rows()[index], ...row };
      else rows().push({ ...row });
      return { data: null, error: null };
    },
    update(patch: Row) {
      const narrowing = [...filters];
      let ran = false;
      // Apply inside then(), before the promise yields, so a second claim
      // resumed just after this one already sees the written name.
      const run = () => {
        if (ran) return { data: [] as Row[], error: null };
        ran = true;
        const touched: Row[] = [];
        for (const row of rows()) {
          if (!matches(row, narrowing)) continue;
          Object.assign(row, patch);
          touched.push(row);
        }
        return { data: touched, error: null };
      };
      const chain = () => {
        const thenable = {
          eq(col: string, val: unknown) {
            narrowing.push({ op: "eq", col, val });
            return chain();
          },
          is(col: string, val: unknown) {
            narrowing.push({ op: "is", col, val });
            return chain();
          },
          or(expression: string) {
            if (expression.includes("display_name.is.null")) narrowing.push({ op: "unnamed", col: "display_name", val: null });
            return chain();
          },
          select() {
            return chain();
          },
          then(resolve: (value: { data: Row[]; error: null }) => unknown, reject: (reason: unknown) => unknown) {
            return Promise.resolve(run()).then(resolve, reject);
          },
        };
        return thenable;
      };
      return {
        eq(col: string, val: unknown) {
          narrowing.push({ op: "eq", col, val });
          return chain();
        },
      };
    },
    delete() {
      const narrowing = [...filters];
      let removed: Row[] | null = null;
      const run = () => {
        if (!removed) {
          const all = rows();
          removed = all.filter((row) => matches(row, narrowing));
          tables.current[name] = all.filter((row) => !matches(row, narrowing));
        }
        return { data: removed, error: null };
      };
      const chain = () => ({
        eq(col: string, val: unknown) {
          narrowing.push({ op: "eq", col, val });
          return chain();
        },
        select() {
          return chain();
        },
        then(resolve: (value: { data: Row[]; error: null }) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      });
      return chain();
    },
    then(resolve: (value: { data: Row[]; error: null }) => unknown, reject: (reason: unknown) => unknown) {
      return Promise.resolve({ data: found(), error: null }).then(resolve, reject);
    },
  };
  return builder;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from,
    auth: {
      admin: {
        createUser: async () => ({ data: { user: { id: USER } }, error: null }),
        generateLink: async () => ({ data: { properties: { email_otp: "12345678" } }, error: null }),
      },
    },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { verifyOtp: async () => ({ data: { user: { id: USER } }, error: null }) },
  }),
}));

vi.mock("@/lib/billing/notices", () => ({ kickPlanNotices: () => {} }));
vi.mock("@/lib/billing/usage", () => ({ eventIsFull: async () => false, GUESTS_FULL: "KB002" }));
vi.mock("@/lib/email/send", () => ({ sendSignInCode: async () => {} }));

const { verifyCode, claimSignInName, joinByLink, processCodeRequest, MAX_VERIFY_ATTEMPTS } = await import("@/lib/auth/flow");

function pending(overrides: Row = {}): Row {
  return {
    email: "ada@example.com",
    claimed_name: null,
    flow: "member",
    event_id: null,
    user_id: null,
    attempts: 0,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

function event(overrides: Row = {}): Row {
  return {
    id: EVENT,
    name: "Summit",
    handle: "summit",
    access_mode: "link",
    status: "active",
    deleted_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  tables.current = { pending_sign_ins: [], users: [{ id: USER, email: "ada@example.com", display_name: null }], memberships: [], events: [], event_roles: [] };
});

describe("verifyCode", () => {
  it("keeps a new account's pending row, bound to the user, for longer than fifteen minutes", async () => {
    tables.current.pending_sign_ins = [pending()];
    const result = await verifyCode("ada@example.com", "12345678");
    expect(result).toMatchObject({ ok: true, redirectTo: NAME_STEP_PATH });
    const row = tables.current.pending_sign_ins[0];
    expect(row.user_id).toBe(USER);
    expect(row.attempts).toBe(MAX_VERIFY_ATTEMPTS);
    expect(new Date(String(row.expires_at)).getTime()).toBeGreaterThan(Date.now() + 15 * 60 * 1000);
    expect(tables.current.memberships).toHaveLength(0);
  });

  it("finishes a returning account without asking for a name", async () => {
    tables.current.users[0].display_name = "Ada Lovelace";
    tables.current.pending_sign_ins = [pending()];
    tables.current.memberships = [
      {
        id: "m1",
        event_id: EVENT,
        role: "event_member",
        roster_email: "ada@example.com",
        roster_name: "Ada Lovelace",
        claimed_name: "Ada Lovelace",
        status: "active",
        first_seen_at: "2026-01-01T00:00:00.000Z",
        name_approved_at: null,
        name_review_at: null,
        events: { name: "Summit", handle: "summit", status: "active", deleted_at: null },
      },
    ];
    const result = await verifyCode("ada@example.com", "12345678");
    expect(result).toMatchObject({ ok: true, redirectTo: "/e/summit" });
    expect(tables.current.pending_sign_ins).toHaveLength(0);
  });

  it("finishes create-an-event, which already collected a name", async () => {
    tables.current.pending_sign_ins = [pending({ flow: "create", claimed_name: "Ada Organiser" })];
    const result = await verifyCode("ada@example.com", "12345678");
    expect(result).toMatchObject({ ok: true, redirectTo: "/admin/new" });
    expect(tables.current.pending_sign_ins).toHaveLength(0);
    expect(tables.current.users[0].display_name).toBe("Ada Organiser");
  });
});

describe("claimSignInName", () => {
  it("still joins when the name arrives more than fifteen minutes after the code", async () => {
    tables.current.events = [event()];
    tables.current.pending_sign_ins = [
      pending({
        flow: "join",
        event_id: EVENT,
        user_id: USER,
        attempts: MAX_VERIFY_ATTEMPTS,
        expires_at: new Date(Date.now() + 16 * 60 * 1000).toISOString(),
      }),
    ];
    const result = await claimSignInName({ userId: USER, email: "ada@example.com", name: "Ada Lovelace" });
    expect(result).toMatchObject({ ok: true, redirectTo: "/e/summit" });
    expect(tables.current.pending_sign_ins).toHaveLength(0);
    expect(tables.current.memberships[0]).toMatchObject({ roster_name: "Ada Lovelace", claimed_name: "Ada Lovelace" });
    expect(String(tables.current.memberships[0].roster_name)).not.toBe("ada");
    expect(tables.current.memberships[0].name_review_at ?? null).toBeNull();
  });

  it("saves the name and finishes as a member when the row has expired", async () => {
    tables.current.events = [event()];
    tables.current.pending_sign_ins = [
      pending({
        user_id: USER,
        flow: "join",
        event_id: EVENT,
        expires_at: new Date(Date.now() - 1000).toISOString(),
      }),
    ];
    const expired = await claimSignInName({ userId: USER, email: "ada@example.com", name: "Ada Lovelace" });
    expect(expired).toMatchObject({ ok: true, redirectTo: "/events" });
    expect(tables.current.users[0].display_name).toBe("Ada Lovelace");
    expect(tables.current.memberships).toHaveLength(0);
    expect(tables.current.pending_sign_ins).toHaveLength(0);
  });

  it("saves the name for a password sign-in that never wrote a pending row", async () => {
    tables.current.events = [event()];
    const result = await claimSignInName({ userId: USER, email: "ada@example.com", name: "Ada Lovelace" });
    expect(result).toMatchObject({ ok: true, redirectTo: "/events" });
    expect(tables.current.users[0].display_name).toBe("Ada Lovelace");
    expect(tables.current.memberships).toHaveLength(0);
  });

  it("does not retarget a bound name-step row when another code is requested", async () => {
    const other = "33333333-3333-4333-8333-333333333333";
    const expires = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString();
    tables.current.events = [event(), event({ id: other, handle: "other", name: "Other" })];
    tables.current.pending_sign_ins = [
      pending({
        flow: "join",
        event_id: EVENT,
        claimed_name: null,
        user_id: USER,
        attempts: MAX_VERIFY_ATTEMPTS,
        expires_at: expires,
      }),
    ];
    await processCodeRequest({ email: "Ada@Example.com", flow: "join", event: "other", fullName: "Attacker" });
    expect(tables.current.pending_sign_ins[0]).toMatchObject({
      user_id: USER,
      flow: "join",
      event_id: EVENT,
      claimed_name: null,
      attempts: MAX_VERIFY_ATTEMPTS,
      expires_at: expires,
    });
    const result = await claimSignInName({ userId: USER, email: "ada@example.com", name: "Ada Lovelace" });
    expect(result).toMatchObject({ ok: true, redirectTo: "/e/summit" });
    expect(tables.current.memberships).toHaveLength(1);
    expect(tables.current.memberships[0].event_id).toBe(EVENT);
  });

  it("still refreshes a code request that is not bound to a user", async () => {
    tables.current.events = [event()];
    tables.current.pending_sign_ins = [pending({ flow: "join", event_id: EVENT, user_id: null, attempts: 2 })];
    tables.current.memberships = [
      {
        id: "m1",
        event_id: EVENT,
        role: "event_member",
        roster_email: "ada@example.com",
        roster_name: "Ada Lovelace",
        claimed_name: null,
        status: "active",
        first_seen_at: "2026-01-01T00:00:00.000Z",
        name_approved_at: null,
        name_review_at: null,
        events: { name: "Summit", handle: "summit", status: "active", deleted_at: null },
      },
    ];
    await processCodeRequest({ email: "ada@example.com", flow: "member" });
    expect(tables.current.pending_sign_ins).toHaveLength(1);
    expect(tables.current.pending_sign_ins[0]).toMatchObject({ user_id: null, flow: "member", event_id: null, attempts: 0 });
  });

  it("saves a name when the account's display name is blank", async () => {
    tables.current.users[0].display_name = "   ";
    tables.current.pending_sign_ins = [
      pending({ user_id: USER, expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }),
    ];
    const result = await claimSignInName({ userId: USER, email: "ada@example.com", name: "Ada Lovelace" });
    expect(result.ok).toBe(true);
    expect(tables.current.users[0].display_name).toBe("Ada Lovelace");
  });

  it("lets only one of two parallel claims finish the join", async () => {
    tables.current.events = [event()];
    tables.current.pending_sign_ins = [
      pending({
        flow: "join",
        event_id: EVENT,
        user_id: USER,
        attempts: MAX_VERIFY_ATTEMPTS,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
    ];
    const [first, second] = await Promise.all([
      claimSignInName({ userId: USER, email: "ada@example.com", name: "Ada Lovelace" }),
      claimSignInName({ userId: USER, email: "ada@example.com", name: "Ada Lovelace" }),
    ]);
    const results = [first, second];
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok && result.status === 409)).toHaveLength(1);
    expect(results.find((result) => result.ok)).toMatchObject({ redirectTo: "/e/summit" });
    expect(tables.current.memberships).toHaveLength(1);
  });

  it("refuses a second claim after a name is saved", async () => {
    tables.current.users[0].display_name = "Ada Lovelace";
    tables.current.pending_sign_ins = [pending({ user_id: USER, flow: "join", event_id: EVENT })];
    const named = await claimSignInName({ userId: USER, email: "ada@example.com", name: "Someone Else" });
    expect(named).toMatchObject({ ok: false, status: 409 });
    expect(tables.current.pending_sign_ins).toHaveLength(0);
    expect(tables.current.memberships).toHaveLength(0);
  });

  it("still holds a guest-list name that does not match", async () => {
    tables.current.pending_sign_ins = [pending({ user_id: USER, expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() })];
    tables.current.memberships = [
      {
        id: "m1",
        event_id: EVENT,
        role: "event_member",
        roster_email: "ada@example.com",
        roster_name: "Serena Cheung",
        claimed_name: null,
        status: "pending",
        first_seen_at: null,
        name_approved_at: null,
        name_review_at: null,
        events: { name: "Summit", handle: "summit", status: "active", deleted_at: null },
      },
    ];
    const result = await claimSignInName({ userId: USER, email: "ada@example.com", name: "Someone Else" });
    expect(result.ok).toBe(true);
    expect(tables.current.memberships[0].name_mismatch).toBe(true);
    expect(tables.current.memberships[0].name_review_at).toEqual(expect.any(String));
  });
});

describe("joinByLink", () => {
  it("does not store the mailbox name when no name was given", async () => {
    tables.current.events = [event()];
    expect(await joinByLink(EVENT, USER, "ada@example.com", null)).toBe("refused");
    expect(tables.current.memberships).toHaveLength(0);
  });
});
