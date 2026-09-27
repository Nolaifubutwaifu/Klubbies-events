import { expect, test, type Page } from "@playwright/test";
import { admin, createWorld, destroyWorld, signIn, type World } from "./fixtures";

// Deleting your own account from the profile page: what Apple requires every
// app with sign-in to offer. See lib/account/delete.ts for the rules.

let world: World;

test.beforeAll(async () => {
  world = await createWorld();
});

test.afterAll(async () => {
  if (!world) return;
  await admin().from("events").delete().like("handle", `e2e_${world.runId}_%`);
  await destroyWorld(world);
});

async function userIdFor(email: string): Promise<string | null> {
  const { data } = await admin().auth.admin.listUsers({ perPage: 1000 });
  return data?.users.find((user) => user.email === email)?.id ?? null;
}

async function openDeletePanel(page: Page) {
  await page.goto("/account");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("heading", { name: "Delete your account" })).toBeVisible();
}

async function confirmDeletion(page: Page) {
  const button = page.locator("form").getByRole("button", { name: "Delete my account" });
  await expect(button).toBeDisabled();
  await page.getByLabel("I understand my account is deleted for good.").check();
  await button.click();
  await expect(page).toHaveURL(/\/account-deleted$/);
}

async function makeEvent(label: string, accessMode: "link" | "guest_list") {
  const db = admin();
  const { data: event } = await db
    .from("events")
    .insert({ handle: `e2e_${world.runId}_${label}`, name: `E2E ${label} ${world.runId}`, access_mode: accessMode })
    .select("id, name")
    .single();
  return event!;
}

test("an attendee who joined through the link leaves the list with their account", async ({ page, context, request }) => {
  const email = `leaver.${world.runId}@e2e.klubbies.test`;
  const db = admin();
  // Event A is in link mode, so this row is what joining made.
  await db.from("memberships").insert({ event_id: world.eventA.id, roster_email: email, roster_name: "Lena Leaver", status: "active" });
  await signIn(context, request, email, "Lena Leaver");
  const userId = (await userIdFor(email))!;

  // Things that must go with the account.
  await db.from("favourites").insert({ event_id: world.eventA.id, user_id: userId, media_id: world.eventA.mediaId });
  await db.from("push_devices").insert({ user_id: userId, token: `ab${world.runId}`.padEnd(64, "0"), environment: "sandbox" });

  await openDeletePanel(page);
  await confirmDeletion(page);

  expect(await userIdFor(email)).toBeNull();
  const { count: favourites } = await db.from("favourites").select("*", { count: "exact", head: true }).eq("user_id", userId);
  expect(favourites).toBe(0);
  const { count: devices } = await db.from("push_devices").select("*", { count: "exact", head: true }).eq("user_id", userId);
  expect(devices).toBe(0);
  const { count: rows } = await db.from("memberships").select("*", { count: "exact", head: true }).eq("roster_email", email);
  expect(rows).toBe(0);

  // And the session is gone.
  const res = await page.goto("/account");
  expect(page.url()).not.toContain("/account");
  expect(res?.ok()).toBeTruthy();
});

test("a guest-list attendee stays on the list, as not joined yet", async ({ page, context, request }) => {
  const email = `listed.${world.runId}@e2e.klubbies.test`;
  const db = admin();
  const event = await makeEvent("list", "guest_list");
  await db.from("memberships").insert({ event_id: event.id, roster_email: email, roster_name: "Gus Guest" });
  await signIn(context, request, email, "Gus Guest");

  await openDeletePanel(page);
  await confirmDeletion(page);

  const { data: row } = await db.from("memberships").select("user_id, status, claimed_name").eq("roster_email", email).single();
  expect(row).toEqual({ user_id: null, status: "pending", claimed_name: null });
});

test("the only organiser of an event with attendees must add a co-organiser first", async ({ page, context, request }) => {
  const email = `owner.${world.runId}@e2e.klubbies.test`;
  const other = `stayer.${world.runId}@e2e.klubbies.test`;
  const db = admin();
  await db
    .from("memberships")
    .insert({ event_id: world.eventB.id, roster_email: email, roster_name: "Olive Owner", role: "event_admin", status: "active" });
  // Someone else has joined event B.
  const { data: created } = await db.auth.admin.createUser({ email: other, email_confirm: true });
  await db
    .from("memberships")
    .insert({ event_id: world.eventB.id, roster_email: other, roster_name: "Sam Stayer", user_id: created.user!.id, status: "active" });

  await signIn(context, request, email, "Olive Owner");
  await openDeletePanel(page);
  await expect(page.getByText(/You.re the only organiser of/)).toBeVisible();
  await expect(page.getByRole("link", { name: `Add a co-organiser to E2E b ${world.runId}` })).toBeVisible();
  await expect(page.getByLabel("I understand my account is deleted for good.")).toHaveCount(0);
  expect(await userIdFor(email)).not.toBeNull();
});

test("an event nobody else joined closes with its only organiser", async ({ page, context, request }) => {
  const email = `solo.${world.runId}@e2e.klubbies.test`;
  const db = admin();
  const event = await makeEvent("solo", "link");
  await db
    .from("memberships")
    .insert({ event_id: event.id, roster_email: email, roster_name: "Sol Solo", role: "event_admin", status: "active" });

  await signIn(context, request, email, "Sol Solo");
  await openDeletePanel(page);
  await expect(page.getByText(/closes with your account/)).toBeVisible();
  await confirmDeletion(page);

  const { count } = await db.from("events").select("*", { count: "exact", head: true }).eq("id", event.id);
  expect(count).toBe(0);
  expect(await userIdFor(email)).toBeNull();
});
