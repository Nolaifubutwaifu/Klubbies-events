import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { NEXT_COOKIE } from "@/lib/auth/next-path";
import { NAME_STEP_PATH } from "@/lib/auth/verify-destination";

const USER = "11111111-1111-4111-8111-111111111111";
const PHOTO = "/e/abc/a/123?photo=9";

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    opts: { cookies: { setAll: (cookies: { name: string; value: string; options?: { path?: string; httpOnly?: boolean } }[]) => void } },
  ) => {
    opts.cookies.setAll([
      { name: "sb-access-token", value: "refreshed", options: { path: "/", httpOnly: true } },
    ]);
    return {
      auth: {
        getClaims: async () => ({ data: { claims: { sub: USER } } }),
      },
    };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { display_name: null }, error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/env", () => ({
  serverEnv: () => ({ SIGNED_URL_SECRET: "0123456789abcdef" }),
}));

import { proxy } from "@/proxy";

describe("name-gate redirect", () => {
  it("keeps the refreshed session cookies on the 303", async () => {
    const request = new NextRequest(`http://localhost:3000${PHOTO}`, {
      headers: { accept: "text/html" },
    });
    const response = await proxy(request);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`http://localhost:3000${NAME_STEP_PATH}`);
    expect(response.cookies.get("sb-access-token")?.value).toBe("refreshed");
    expect(response.cookies.get(NEXT_COOKIE)?.value).toBe(PHOTO);
  });
});
