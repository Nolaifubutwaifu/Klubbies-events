import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NameStepSignOut } from "@/app/(auth)/signin/name/NameStepSignOut";

describe("name step sign-out", () => {
  it("posts to sign-out from the name step", () => {
    const html = renderToStaticMarkup(createElement(NameStepSignOut));
    expect(html).toContain('action="/api/auth/signout"');
    expect(html).toContain('method="post"');
    expect(html).toContain("Sign out");
  });
});
