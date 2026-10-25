import { describe, expect, it } from "vitest";
import { safeNextPath as shippedSafeNextPath } from "@/lib/auth/next-path";
import { NAME_STEP_PATH, pathAfterVerify } from "@/lib/auth/verify-destination";
import { safeNextPath as openRedirectSafeNextPath } from "../fixtures/open-redirect-next-path";

describe("pathAfterVerify", () => {
  it("sends a new account to the name step even when the open-redirect check rejects it", () => {
    for (const safeNextPath of [shippedSafeNextPath, openRedirectSafeNextPath]) {
      expect(safeNextPath(NAME_STEP_PATH)).toBeNull();
      expect(safeNextPath("/signin/code")).toBeNull();
      expect(safeNextPath("/e/summit/a/album")).toBe("/e/summit/a/album");

      const nameStep = pathAfterVerify({ needsName: true, redirectTo: NAME_STEP_PATH });
      expect(nameStep).toBe(NAME_STEP_PATH);
      expect(safeNextPath(nameStep)).toBeNull();

      expect(pathAfterVerify({ redirectTo: NAME_STEP_PATH })).toBe(NAME_STEP_PATH);
      expect(pathAfterVerify({ redirectTo: "/e/summit" })).toBe("/e/summit");
      expect(pathAfterVerify({})).toBeNull();
    }
  });
});
