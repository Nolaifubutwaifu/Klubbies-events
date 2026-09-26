import { expect, test } from "@playwright/test";
import { admin, createWorld, destroyWorld, signIn, type World } from "./fixtures";

let world: World;

test.beforeAll(async () => {
  world = await createWorld();
});

test.afterAll(async () => {
  if (world) await destroyWorld(world);
});

test("non-member is refused", async ({ page, context, request }) => {
  // The request_code response must not reveal whether an email is on a roster.
  const known = await request.post("/api/auth/request_code", { data: { fullName: "Mara Lindqvist", email: world.memberEmail } });
  const unknown = await request.post("/api/auth/request_code", { data: { fullName: "Nobody", email: world.outsiderEmail } });
  expect(known.status()).toBe(unknown.status());
  expect(await known.json()).toEqual(await unknown.json());

  // Even with a verified session, someone on no roster sees nothing.
  await signIn(context, request, world.outsiderEmail, "Nobody");
  const res = await page.goto(`/c/${world.clubA.handle}`);
  expect(res?.status()).toBe(404);
  const signed = await context.request.post("/api/media/sign", { data: { mediaIds: [world.clubA.mediaId] } });
  expect((await signed.json()).urls).toEqual({});
});

test("member sees only their club", async ({ page, context, request }) => {
  const { redirectTo } = await signIn(context, request, world.memberEmail, "Mara Lindqvist");
  expect(redirectTo).toBe(`/c/${world.clubA.handle}`);

  await page.goto(redirectTo);
  await expect(page.getByRole("heading", { level: 1, name: `E2E a ${world.runId}` })).toBeVisible();
  await expect(page.getByText("Album a")).toBeVisible();

  const other = await page.goto(`/c/${world.clubB.handle}`);
  expect(other?.status()).toBe(404);

  const signed = await context.request.post("/api/media/sign", { data: { mediaIds: [world.clubA.mediaId, world.clubB.mediaId] } });
  const { urls } = await signed.json();
  expect(Object.keys(urls)).toEqual([world.clubA.mediaId]);
});

test("revoked member loses access", async ({ page, context, request }) => {
  await signIn(context, request, world.memberEmail, "Mara Lindqvist");
  await page.goto(`/c/${world.clubA.handle}`);
  await expect(page.getByText("Album a")).toBeVisible();

  await admin().from("memberships").update({ status: "revoked" }).eq("club_id", world.clubA.id).eq("roster_email", world.memberEmail);

  const res = await page.goto(`/c/${world.clubA.handle}`);
  expect(res?.status()).toBe(404);
  const signed = await context.request.post("/api/media/sign", { data: { mediaIds: [world.clubA.mediaId] } });
  expect((await signed.json()).urls).toEqual({});

  await admin().from("memberships").update({ status: "active" }).eq("club_id", world.clubA.id).eq("roster_email", world.memberEmail);
});

test("signed URL expires", async ({ context, request }) => {
  await signIn(context, request, world.memberEmail, "Mara Lindqvist");
  const signed = await context.request.post("/api/media/sign", { data: { mediaIds: [world.clubA.mediaId], variant: "thumb" } });
  const url: string = (await signed.json()).urls[world.clubA.mediaId];
  expect(url).toBeTruthy();

  expect((await request.get(url)).status()).toBe(200);
  await new Promise((resolve) => setTimeout(resolve, 6000));
  expect((await request.get(url)).status()).toBeGreaterThanOrEqual(400);
});
