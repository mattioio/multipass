import { expect, test } from "@playwright/test";

test("local browser navigation: pick -> lobby -> local-or-landing", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/#landing$/);

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("#screen-local.active")).toBeVisible();
  await expect(page).toHaveURL(/#local$/);

  await page.locator('#local-fruit-grid .fruit-option[data-fruit="banana"]').click();
  await page.locator('#local-fruit-grid .fruit-option[data-fruit="kiwi"]').click();
  await expect(page.locator("#screen-lobby.active")).toBeVisible();
  await expect(page).toHaveURL(/#lobby$/);

  await page.getByRole("button", { name: "Pick a game" }).click();
  await expect(page.locator("#screen-pick.active")).toBeVisible();
  await expect(page).toHaveURL(/#pick$/);

  await page.goBack();
  await expect(page.locator("#screen-lobby.active")).toBeVisible();
  await expect(page).toHaveURL(/#lobby$/);

  await page.goBack();
  await expect.poll(() => new URL(page.url()).hash).toMatch(/^#(local|landing)$/);
});

test("online browser back exits room flow from lobby to landing", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  await hostPage.goto("/");
  await hostPage.getByRole("button", { name: "Host a room" }).click();
  await expect(hostPage).toHaveURL(/#host$/);
  await hostPage.locator('#host-fruit-picker .fruit-option[data-fruit="banana"]').click();
  await hostPage.getByRole("button", { name: "Create room" }).click();
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(hostPage).toHaveURL(/#lobby$/);

  const roomCode = (await hostPage.locator("#room-code").textContent())?.trim() || "";
  await guestPage.goto("/");
  await guestPage.getByRole("button", { name: "Join a room" }).click();
  await guestPage.locator("#join-code").fill(roomCode);
  await guestPage.getByRole("button", { name: "Continue" }).click();
  await guestPage.locator('#join-fruit-picker .fruit-option[data-fruit="kiwi"]').click();
  await guestPage.getByRole("button", { name: "Join room" }).click();
  await expect(guestPage.locator("#screen-lobby.active")).toBeVisible();

  await hostPage.getByRole("button", { name: "Pick a game" }).click();
  await expect(hostPage.locator("#screen-pick.active")).toBeVisible();
  await expect(hostPage).toHaveURL(/#pick$/);

  await hostPage.goBack();
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(hostPage).toHaveURL(/#lobby$/);

  await hostPage.goBack();
  await expect.poll(() => new URL(hostPage.url()).hash).toMatch(/^#(host|landing)$/);

  await hostContext.close();
  await guestContext.close();
});

test("hash guards: invalid deep link normalizes and join route survives refresh", async ({ page }) => {
  await page.goto("/#game");
  await expect(page.locator("#screen-landing.active")).toBeVisible();
  await expect(page).toHaveURL(/#landing$/);

  await page.goto("/#join");
  await expect(page.locator("#screen-join.active")).toBeVisible();
  await expect(page).toHaveURL(/#join$/);

  await page.reload();
  await expect(page.locator("#screen-join.active")).toBeVisible();
  await expect(page).toHaveURL(/#join$/);
});
