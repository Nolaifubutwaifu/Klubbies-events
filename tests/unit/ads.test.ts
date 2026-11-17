import { readFileSync } from "node:fs";
import vm from "node:vm";
import { afterEach, describe, expect, it } from "vitest";
import {
  adsForRequest,
  attributionFromParams,
  decodeAttribution,
  decorateAdsRedirect,
  encodeAttribution,
  googleAdsBootstrap,
  googleAdsEventLabel,
  googleAdsId,
  googleAdsScriptSrc,
  googleAdsSignupLabel,
  isNewOrganiserSignup,
  loadsGoogleAds,
} from "@/lib/ads";

const ENV_KEYS = [
  "NEXT_PUBLIC_GOOGLE_ADS_ID",
  "NEXT_PUBLIC_GOOGLE_ADS_EVENT_CREATED_LABEL",
  "NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL",
] as const;

const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function setEnv(key: string, value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[key];
  else env[key] = value;
}

afterEach(() => {
  for (const key of ENV_KEYS) setEnv(key, saved[key]);
});

const ID = "AW-1234567890";
const EVENT_LABEL = "AbC-EventLabel1";
const SIGNUP_LABEL = "XyZ-SignupLabel1";
const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function enableAds() {
  setEnv("NEXT_PUBLIC_GOOGLE_ADS_ID", ID);
  setEnv("NEXT_PUBLIC_GOOGLE_ADS_EVENT_CREATED_LABEL", EVENT_LABEL);
  setEnv("NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL", SIGNUP_LABEL);
}

describe("google ads id", () => {
  it("stays off until the id matches AW- and 9 to 11 digits", () => {
    expect(googleAdsId()).toBeNull();
    expect(googleAdsEventLabel()).toBeNull();
    expect(googleAdsSignupLabel()).toBeNull();
    expect(googleAdsScriptSrc("AW-1234567890")).toBe("https://www.googletagmanager.com/gtag/js?id=AW-1234567890");
    expect(googleAdsScriptSrc("nope")).toBeNull();

    setEnv("NEXT_PUBLIC_GOOGLE_ADS_ID", "AW-123");
    expect(googleAdsId()).toBeNull();
    setEnv("NEXT_PUBLIC_GOOGLE_ADS_ID", "aw-1234567890");
    expect(googleAdsId()).toBeNull();
    setEnv("NEXT_PUBLIC_GOOGLE_ADS_ID", "AW-1234567890<script>");
    expect(googleAdsId()).toBeNull();

    enableAds();
    expect(googleAdsId()).toBe(ID);
    expect(googleAdsEventLabel()).toBe(EVENT_LABEL);
    expect(googleAdsSignupLabel()).toBe(SIGNUP_LABEL);

    setEnv("NEXT_PUBLIC_GOOGLE_ADS_EVENT_CREATED_LABEL", "bad label");
    expect(googleAdsEventLabel()).toBeNull();
    setEnv("NEXT_PUBLIC_GOOGLE_ADS_ID", undefined);
    expect(googleAdsSignupLabel()).toBeNull();
  });
});

describe("where the tag is allowed", () => {
  it("allows marketing and organiser routes", () => {
    for (const path of [
      "/",
      "/pricing",
      "/privacy",
      "/guides/get-event-photos-to-attendees-fast",
      "/account-deleted",
      "/photographers",
      "/start",
      "/admin/new",
      "/admin/demo/setup",
    ]) {
      expect(loadsGoogleAds(path), path).toBe(true);
    }
  });

  it("refuses guest galleries, doors, share links and shared account pages", () => {
    for (const path of [
      "/e/demo",
      "/e/demo/a/11111111-1111-4111-8111-111111111111",
      "/e/demo/a/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222",
      "/e/demo/me",
      "/e/demo/saved",
      "/g/7hK2-wRq9-mB4t",
      "/signin",
      "/signin?event=demo",
      "/signin/code",
      "/signin/code?flow=create",
      "/events",
      "/account",
      "/ops/usage",
      "//evil.example/pricing",
      "https://evil.example/pricing",
    ]) {
      expect(loadsGoogleAds(path), path).toBe(false);
    }
  });

  it("mounts the tag only on marketing, start and admin layouts", () => {
    const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
    for (const path of ["app/(marketing)/layout.tsx", "app/(app)/admin/layout.tsx", "app/(auth)/start/page.tsx"]) {
      expect(source(path), path).toContain('from "@/components/GoogleAds"');
    }
    for (const path of [
      "app/layout.tsx",
      "app/(app)/layout.tsx",
      "app/(app)/e/[handle]/layout.tsx",
      "app/(app)/events/page.tsx",
      "app/(app)/account/page.tsx",
      "app/(auth)/signin/page.tsx",
      "app/(auth)/signin/code/page.tsx",
      "app/g/[token]/page.tsx",
      "app/(print)/admin/[handle]/share/poster/page.tsx",
    ]) {
      expect(source(path), path).not.toContain("GoogleAds");
    }
  });
});

describe("attribution", () => {
  it("keeps click ids and utm fields and drops anything else", () => {
    const params = new URLSearchParams(
      "gclid=CLICK-id_1&gbraid=GB-1&wbraid=WB-1&utm_source=google&utm_medium=cpc&utm_campaign=launch&utm_term=event photos&utm_content=ad-1&src=flyer&email=a@b.c",
    );
    const encoded = encodeAttribution(attributionFromParams(params));
    expect(encoded).toBeTruthy();
    expect(decodeAttribution(encoded)).toEqual({
      gclid: "CLICK-id_1",
      gbraid: "GB-1",
      wbraid: "WB-1",
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "launch",
      utm_term: "event photos",
      utm_content: "ad-1",
    });
    expect(decodeAttribution(encoded)).not.toHaveProperty("src");
    expect(attributionFromParams(new URLSearchParams("gclid=<script>"))).toBeNull();
    expect(attributionFromParams(new URLSearchParams("utm_source=a/b"))).toBeNull();
    expect(decodeAttribution("not base64!!!")).toBeNull();
    expect(decodeAttribution(undefined)).toBeNull();
  });

  it("stores nothing until the id is set, and never from a guest URL", () => {
    const params = new URLSearchParams("gclid=CLICK-id_1&utm_source=google");
    expect(adsForRequest({ pathname: "/", searchParams: params, cookie: undefined })).toEqual({
      header: null,
      setCookie: null,
    });
    enableAds();
    expect(adsForRequest({ pathname: "/e/demo", searchParams: params, cookie: undefined })).toEqual({
      header: null,
      setCookie: null,
    });
    expect(adsForRequest({ pathname: "/g/7hK2-wRq9-mB4t", searchParams: params, cookie: undefined })).toEqual({
      header: null,
      setCookie: null,
    });
    expect(adsForRequest({ pathname: "/signin", searchParams: params, cookie: undefined })).toEqual({
      header: null,
      setCookie: null,
    });

    const first = adsForRequest({ pathname: "/pricing", searchParams: params, cookie: undefined });
    expect(first.setCookie).toBe(first.header);
    expect(decodeAttribution(first.header)).toEqual({ gclid: "CLICK-id_1", utm_source: "google" });

    const later = adsForRequest({
      pathname: "/admin/new",
      searchParams: new URLSearchParams("gclid=SECOND"),
      cookie: first.setCookie ?? undefined,
    });
    expect(later.setCookie).toBeNull();
    expect(decodeAttribution(later.header)?.gclid).toBe("CLICK-id_1");
  });

  it("adds click ids only to same-origin organiser redirects", () => {
    const encoded = encodeAttribution({ gclid: "CLICK-id_1", utm_source: "google" }) ?? "";
    expect(decorateAdsRedirect("/admin/new", encoded)).toBe("/admin/new");
    expect(decorateAdsRedirect("/e/demo?x=1", encoded)).toBe("/e/demo?x=1");

    enableAds();
    expect(decorateAdsRedirect("/admin/new", encoded)).toBe("/admin/new?gclid=CLICK-id_1&utm_source=google");
    expect(decorateAdsRedirect("/admin/demo/setup?gclid=already", encoded)).toBe("/admin/demo/setup?gclid=already&utm_source=google");
    expect(decorateAdsRedirect("/e/demo", encoded)).toBe("/e/demo");
    // /signin is not a legal post-login path, so it is refused rather than decorated.
    expect(decorateAdsRedirect("/signin?event=demo", encoded)).toBe("/events");
    expect(decorateAdsRedirect("/events", encoded)).toBe("/events");
    expect(decorateAdsRedirect("https://evil.example/admin/new", encoded)).toBe("/events");
    expect(decorateAdsRedirect("//evil.example", encoded)).toBe("/events");
    expect(decorateAdsRedirect("/\\evil.example", encoded)).toBe("/events");
    expect(decorateAdsRedirect("/admin/new", encodeAttribution({ gclid: "ok" }) ?? "")).toBe("/admin/new?gclid=ok");
  });
});

describe("new organiser account", () => {
  const pending = "2026-11-01T00:00:10.000Z";

  it("counts the create flow only when the auth user was just created", () => {
    expect(
      isNewOrganiserSignup({
        flow: "create",
        userCreatedAt: "2026-11-01T00:00:09.000Z",
        pendingCreatedAt: pending,
        membershipCount: 0,
      }),
    ).toBe(true);

    expect(
      isNewOrganiserSignup({
        flow: "create",
        userCreatedAt: "2026-10-01T00:00:00.000Z",
        pendingCreatedAt: pending,
        membershipCount: 0,
      }),
    ).toBe(false);

    expect(
      isNewOrganiserSignup({
        flow: "join",
        userCreatedAt: "2026-11-01T00:00:09.000Z",
        pendingCreatedAt: pending,
        membershipCount: 0,
      }),
    ).toBe(false);

    expect(
      isNewOrganiserSignup({
        flow: "member",
        userCreatedAt: "2026-11-01T00:00:09.000Z",
        pendingCreatedAt: pending,
        membershipCount: 0,
      }),
    ).toBe(false);

    expect(
      isNewOrganiserSignup({
        flow: "create",
        userCreatedAt: "2026-11-01T00:00:09.000Z",
        pendingCreatedAt: pending,
        membershipCount: 1,
      }),
    ).toBe(false);

    expect(
      isNewOrganiserSignup({
        flow: "create",
        userCreatedAt: "2026-11-01T00:00:10.000Z",
        pendingCreatedAt: "2026-11-01T00:03:00.000Z",
        membershipCount: 0,
      }),
    ).toBe(false);
  });
});

type LayerEntry = unknown[];

function runTag(code: string, options: { cookie?: string; session?: Record<string, string>; href?: string } = {}) {
  const jar = new Map<string, string>();
  for (const part of (options.cookie ?? "").split("; ").filter(Boolean)) {
    const cut = part.indexOf("=");
    if (cut > 0) jar.set(part.slice(0, cut), decodeURIComponent(part.slice(cut + 1)));
  }
  const store = new Map<string, string>(Object.entries(options.session ?? {}));
  const dataLayer: LayerEntry[] = [];
  const window = {
    dataLayer,
    location: { href: options.href ?? "https://events.klubbies.app/admin/new" },
    sessionStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    },
  };
  const document = {
    get cookie() {
      return [...jar.entries()].map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("; ");
    },
    set cookie(value: string) {
      const [pair] = value.split(";");
      const cut = pair.indexOf("=");
      const name = pair.slice(0, cut).trim();
      if (/Max-Age=0/i.test(value)) jar.delete(name);
      else jar.set(name, pair.slice(cut + 1));
    },
  };
  vm.runInNewContext(code, { window, document, URL, decodeURIComponent, JSON });
  const calls = dataLayer.map((entry) => Array.from(entry as ArrayLike<unknown>));
  return { calls, jar, store };
}

describe("tag bootstrap", () => {
  it("does not build a script for a bad id or label", () => {
    expect(googleAdsBootstrap({ id: "nope", attribution: null, eventLabel: null, signupLabel: null })).toBeNull();
    expect(googleAdsBootstrap({ id: ID, attribution: null, eventLabel: "bad label", signupLabel: null })).toBeNull();
    expect(googleAdsBootstrap({ id: ID, attribution: null, eventLabel: null, signupLabel: "</script>" })).toBeNull();
  });

  it("configures the tag and does not fire a conversion with no cookie", () => {
    const code = googleAdsBootstrap({
      id: ID,
      attribution: { gclid: "CLICK-id_1", utm_source: "google" },
      eventLabel: EVENT_LABEL,
      signupLabel: SIGNUP_LABEL,
    });
    expect(code).toBeTruthy();
    expect(code).not.toContain("</script>");
    const { calls, store } = runTag(code!, { href: "https://events.klubbies.app/admin/demo/setup" });
    expect(calls.some((call) => call[0] === "event")).toBe(false);
    const config = calls.find((call) => call[0] === "config");
    expect(config?.[1]).toBe(ID);
    expect(config?.[2]).toEqual({
      page_location: "https://events.klubbies.app/admin/demo/setup?gclid=CLICK-id_1&utm_source=google",
    });
    expect(JSON.parse(store.get("kb_ads") ?? "{}")).toEqual({ gclid: "CLICK-id_1", utm_source: "google" });
  });

  it("fires the event conversion once, with the event id, then clears the cookie", () => {
    const code = googleAdsBootstrap({
      id: ID,
      attribution: null,
      eventLabel: EVENT_LABEL,
      signupLabel: SIGNUP_LABEL,
    })!;
    const first = runTag(code, { cookie: `kb_ads_event=${EVENT_ID}`, href: "https://events.klubbies.app/admin/demo/setup" });
    const conversion = first.calls.filter((call) => call[0] === "event" && call[1] === "conversion");
    expect(conversion).toHaveLength(1);
    expect(conversion[0][2]).toEqual({ send_to: `${ID}/${EVENT_LABEL}`, transaction_id: EVENT_ID });
    expect(first.jar.has("kb_ads_event")).toBe(false);

    first.jar.set("kb_ads_event", EVENT_ID);
    const second = runTag(code, {
      cookie: `kb_ads_event=${EVENT_ID}`,
      session: Object.fromEntries(first.store),
      href: "https://events.klubbies.app/admin/demo/setup",
    });
    expect(second.calls.filter((call) => call[1] === "conversion")).toHaveLength(0);
  });

  it("fires the signup conversion once per new account id", () => {
    const code = googleAdsBootstrap({
      id: ID,
      attribution: null,
      eventLabel: EVENT_LABEL,
      signupLabel: SIGNUP_LABEL,
    })!;
    const { calls, jar } = runTag(code, { cookie: `kb_ads_signup=${USER_ID}` });
    const conversion = calls.filter((call) => call[1] === "conversion");
    expect(conversion).toHaveLength(1);
    expect(conversion[0][2]).toEqual({ send_to: `${ID}/${SIGNUP_LABEL}`, transaction_id: USER_ID });
    expect(jar.has("kb_ads_signup")).toBe(false);
  });

  it("does not fire when the label is missing, and ignores a junk cookie", () => {
    const code = googleAdsBootstrap({
      id: ID,
      attribution: null,
      eventLabel: null,
      signupLabel: null,
    })!;
    const { calls, jar } = runTag(code, { cookie: `kb_ads_event=${EVENT_ID}; kb_ads_signup=not-a-uuid` });
    expect(calls.filter((call) => call[1] === "conversion")).toHaveLength(0);
    expect(jar.has("kb_ads_event")).toBe(false);
    expect(jar.has("kb_ads_signup")).toBe(false);
  });

  it("restores click ids from sessionStorage and drops unsafe values", () => {
    const code = googleAdsBootstrap({ id: ID, attribution: null, eventLabel: null, signupLabel: null })!;
    const bad = runTag(code, { session: { kb_ads: JSON.stringify({ gclid: "<script>", utm_source: "google" }) } });
    const config = bad.calls.find((call) => call[0] === "config");
    expect(config?.[2]).toEqual({ page_location: "https://events.klubbies.app/admin/new?utm_source=google" });
    expect(JSON.stringify(config)).not.toContain("<script>");

    const fromSession = runTag(code, { session: { kb_ads: JSON.stringify({ gclid: "FROM-session" }) } });
    expect(fromSession.calls.find((call) => call[0] === "config")?.[2]).toEqual({
      page_location: "https://events.klubbies.app/admin/new?gclid=FROM-session",
    });

    expect(() => runTag(code, { session: { kb_ads: "not-json" } })).not.toThrow();
  });
});
