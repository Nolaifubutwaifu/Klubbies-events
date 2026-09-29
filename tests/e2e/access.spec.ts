import { expect, test } from "@playwright/test";
import { admin, createWorld, destroyWorld, signIn, type World } from "./fixtures";

let world: World;

test.beforeAll(async () => {
  world = await createWorld();
});

test.afterAll(async () => {
  if (world) await destroyWorld(world);
});

test("someone not in the event sees its join screen and no photos", async ({ page, context, request }) => {
  // The request_code response must not reveal whether an email is on a list.
  const known = await request.post("/api/auth/request_code", { data: { fullName: "Mara Lindqvist", email: world.memberEmail } });
  const unknown = await request.post("/api/auth/request_code", { data: { fullName: "Nobody", email: world.outsiderEmail } });
  expect(known.status()).toBe(unknown.status());
  expect(await known.json()).toEqual(await unknown.json());

  // With a verified session but no membership, the event's link shows the
  // join door (events are open to anyone with the link by default), never
  // its albums, and nothing can be signed.
  await signIn(context, request, world.outsiderEmail, "Nobody");
  await page.goto(`/e/${world.eventA.handle}`);
  await expect(page.getByRole("button", { name: "Join event" })).toBeVisible();
  await expect(page.getByText("Album a")).toHaveCount(0);
  const signed = await context.request.post("/api/media/sign", { data: { mediaIds: [world.eventA.mediaId] } });
  expect((await signed.json()).urls).toEqual({});
});

test("a guest-list event can't be joined from its link", async ({ page, context, request }) => {
  await admin().from("events").update({ access_mode: "guest_list" }).eq("id", world.eventB.id);
  await signIn(context, request, world.outsiderEmail, "Nobody");
  await page.goto(`/e/${world.eventB.handle}`);
  await expect(page.getByRole("button", { name: "Join event" })).toHaveCount(0);
  await expect(page.getByText("Album b")).toHaveCount(0);
  await admin().from("events").update({ access_mode: "link" }).eq("id", world.eventB.id);
});

test("member sees only their event", async ({ page, context, request }) => {
  const { redirectTo } = await signIn(context, request, world.memberEmail, "Mara Lindqvist");
  expect(redirectTo).toBe(`/e/${world.eventA.handle}`);

  await page.goto(redirectTo);
  await expect(page.getByRole("heading", { level: 1, name: `E2E a ${world.runId}` })).toBeVisible();
  await expect(page.getByText("Album a")).toBeVisible();

  await page.goto(`/e/${world.eventB.handle}`);
  await expect(page.getByText("Album b")).toHaveCount(0);

  const signed = await context.request.post("/api/media/sign", { data: { mediaIds: [world.eventA.mediaId, world.eventB.mediaId] } });
  const { urls } = await signed.json();
  expect(Object.keys(urls)).toEqual([world.eventA.mediaId]);
});

test("member can download a photo; nobody else can", async ({ context, request }) => {
  await signIn(context, request, world.memberEmail, "Mara Lindqvist");
  const own = await context.request.get(`/api/media/${world.eventA.mediaId}/download`, { maxRedirects: 0 });
  expect(own.status()).toBe(303);
  const other = await context.request.get(`/api/media/${world.eventB.mediaId}/download`, { maxRedirects: 0 });
  expect(other.status()).toBe(404);
});

test("the phone tab bar still works on a short page", async ({ page, context, request }) => {
  // The site footer once sat on top of the fixed tab bar whenever a page was
  // short enough to bring it into view, so Saved could not be left.
  await signIn(context, request, world.memberEmail, "Mara Lindqvist");
  await page.goto(`/e/${world.eventA.handle}/saved`);
  await page.locator("nav[data-tabbar]").getByRole("link", { name: "Photos", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/e/${world.eventA.handle}$`));
});

test("removed attendee loses access and can't rejoin through the link", async ({ page, context, request }) => {
  await signIn(context, request, world.memberEmail, "Mara Lindqvist");
  await page.goto(`/e/${world.eventA.handle}`);
  await expect(page.getByText("Album a")).toBeVisible();

  await admin().from("memberships").update({ status: "revoked" }).eq("event_id", world.eventA.id).eq("roster_email", world.memberEmail);

  await page.goto(`/e/${world.eventA.handle}`);
  await expect(page.getByText("Album a")).toHaveCount(0);
  const signed = await context.request.post("/api/media/sign", { data: { mediaIds: [world.eventA.mediaId] } });
  expect((await signed.json()).urls).toEqual({});

  await page.getByRole("button", { name: "Join event" }).click();
  await expect(page.getByText("The organiser has removed this address from the event.")).toBeVisible();

  await admin().from("memberships").update({ status: "active" }).eq("event_id", world.eventA.id).eq("roster_email", world.memberEmail);
});

test("signed URL expires", async ({ context, request }) => {
  await signIn(context, request, world.memberEmail, "Mara Lindqvist");
  const signed = await context.request.post("/api/media/sign", { data: { mediaIds: [world.eventA.mediaId], variant: "thumb" } });
  const url: string = (await signed.json()).urls[world.eventA.mediaId];
  expect(url).toBeTruthy();

  expect((await request.get(url)).status()).toBe(200);
  await new Promise((resolve) => setTimeout(resolve, 6000));
  expect((await request.get(url)).status()).toBeGreaterThanOrEqual(400);
});
