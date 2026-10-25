import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
const cookieSet = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSet }),
}));
vi.mock("@/lib/auth/session", () => ({
  requireUser: async () => ({ id: "user" }),
  getSessionUser: async () => null,
}));

import { setAreaAction } from "@/app/(app)/actions";

describe("setAreaAction", () => {
  beforeEach(() => {
    redirect.mockClear();
    revalidatePath.mockClear();
    cookieSet.mockClear();
  });

  it("does not redirect to a protocol-relative path", async () => {
    await setAreaAction("member", "//evil.com");
    expect(redirect).toHaveBeenCalledWith("/events");
    expect(revalidatePath).toHaveBeenCalledWith("/events", "layout");
  });
});
