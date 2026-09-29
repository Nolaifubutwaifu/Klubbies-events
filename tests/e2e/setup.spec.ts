import { expect, test } from "@playwright/test";
import { admin, signIn } from "./fixtures";

// A new event is set up in order: details, who can get in, then size. Until
// the size is chosen the organiser menu stays hidden and the overview sends
// the organiser back to the size step.

const runId = Math.random().toString(36).slice(2, 8);
const email = `organiser.${runId}@e2e.klubbies.test`;
const name = `E2E setup ${runId}`;

test.afterAll(async () => {
  const db = admin();
  await db.from("events").delete().like("name", `E2E setup ${runId}%`);
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  for (const user of data?.users ?? []) {
    if (user.email === email) await db.auth.admin.deleteUser(user.id);
  }
});

test("a new event walks through its three steps before the menu appears", async ({ page, context, request }) => {
  await signIn(context, request, email, "Olivia Organiser");
  await page.goto("/admin/new");

  // Step 1 won't move on without a name and a first day.
  await expect(page.getByText("Step 1 of 3")).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Step 1 of 3")).toBeVisible();
  await page.locator("input[name=name]").fill(name);
  await page.locator("input[name=startsOn]").fill("2026-11-20");
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.getByText("Step 2 of 3")).toBeVisible();
  await page.getByRole("button", { name: "Continue to event size" }).click();

  await expect(page).toHaveURL(/\/admin\/[^/]+\/setup$/);
  await expect(page.getByRole("heading", { name: "Choose your event's size" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Organiser" })).toHaveCount(0);

  const handle = new URL(page.url()).pathname.split("/")[2];
  await page.goto(`/admin/${handle}`);
  await expect(page).toHaveURL(new RegExp(`/admin/${handle}/setup$`));

  await page.getByRole("spinbutton").fill("40");
  await page.getByRole("button", { name: "Continue with Free" }).click();
  await expect(page.getByRole("heading", { name: "Get your event ready" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Organiser" })).toHaveCount(1);

  await page.goto(`/admin/${handle}`);
  await expect(page.getByRole("region", { name: "Next step" })).toContainText("Add your logo and colour");
});
