import { expect, test } from "@playwright/test";

test("online happy path: host + guest choose game -> shuffle/game", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  await hostPage.goto("http://127.0.0.1:3000/");
  await hostPage.getByRole("tab", { name: "Online" }).click();
  await hostPage.getByRole("button", { name: "Host a room" }).click();
  await expect(hostPage.getByRole("button", { name: "Pick a player" })).toBeDisabled();
  await hostPage.locator('#host-avatar-picker .avatar-option[data-avatar="yellow"]').click();
  await expect(hostPage.getByRole("button", { name: "Continue" })).toBeEnabled();
  await hostPage.getByRole("button", { name: "Continue" }).click();

  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(hostPage.locator("#room-code")).toContainText(/[A-Z]{4}/);
  const roomCode = (await hostPage.locator("#room-code").textContent())?.trim() || "";

  await guestPage.goto("http://127.0.0.1:3000/");
  await guestPage.getByRole("tab", { name: "Online" }).click();
  await guestPage.getByRole("button", { name: "Join a room" }).click();
  await guestPage.locator("#join-code").fill(roomCode);
  await guestPage.getByRole("button", { name: "Continue" }).click();
  await guestPage.locator('#join-avatar-picker .avatar-option[data-avatar="green"]').click();
  await guestPage.getByRole("button", { name: "Join room" }).click();

  await expect(guestPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();

  await hostPage.getByRole("button", { name: "Pick a game" }).click();
  await guestPage.getByRole("button", { name: "Pick a game" }).click();

  await expect(hostPage.locator("#screen-pick.active")).toBeVisible();
  await expect(guestPage.locator("#screen-pick.active")).toBeVisible();

  await hostPage.getByRole("button", { name: "Play Tic Tac Toe" }).click();
  await guestPage.getByRole("button", { name: "Play Tic Tac Toe" }).click();

  await expect(hostPage.locator("#screen-game.active")).toBeVisible();
  await expect(guestPage.locator("#screen-game.active")).toBeVisible();

  await expect(hostPage.locator("#ttt-board .ttt-cell")).toHaveCount(9);
  await expect(guestPage.locator("#ttt-board .ttt-cell")).toHaveCount(9);

  await hostContext.close();
  await guestContext.close();
});

test("online deep-link join: guest opens #join=CODE invite", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  await hostPage.goto("http://127.0.0.1:3000/");
  await hostPage.getByRole("tab", { name: "Online" }).click();
  await hostPage.getByRole("button", { name: "Host a room" }).click();
  await expect(hostPage.getByRole("button", { name: "Pick a player" })).toBeDisabled();
  await hostPage.locator('#host-avatar-picker .avatar-option[data-avatar="yellow"]').click();
  await expect(hostPage.getByRole("button", { name: "Continue" })).toBeEnabled();
  await hostPage.getByRole("button", { name: "Continue" }).click();
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();

  const roomCode = (await hostPage.locator("#room-code").textContent())?.trim() || "";
  await guestPage.goto(`http://127.0.0.1:3000/#join=${roomCode}`);

  await expect(guestPage.locator("#screen-join.active")).toBeVisible();
  await expect(guestPage.locator("#join-code")).toHaveValue(roomCode);
  await expect(guestPage.getByRole("button", { name: "Join room" })).toBeVisible();

  await guestPage.locator('#join-avatar-picker .avatar-option[data-avatar="green"]').click();
  await guestPage.getByRole("button", { name: "Join room" }).click();

  await expect(guestPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();

  await hostContext.close();
  await guestContext.close();
});

test("online lobby Exit leaves on first click and stays on landing", async ({ page }) => {
  await page.goto("http://127.0.0.1:3000/");
  await page.getByRole("tab", { name: "Online" }).click();
  await page.getByRole("button", { name: "Host a room" }).click();
  await page.locator('#host-avatar-picker .avatar-option[data-avatar="yellow"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#screen-lobby.active")).toBeVisible();

  await page.getByRole("button", { name: "Exit" }).click();
  await expect(page.locator("#screen-landing.active")).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.locator("#screen-landing.active")).toBeVisible();
  await expect.poll(() => new URL(page.url()).hash).toMatch(/^(|#landing)$/);
});

test("online game Exit leaves on first click and stays on landing", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  await hostPage.goto("http://127.0.0.1:3000/");
  await hostPage.getByRole("tab", { name: "Online" }).click();
  await hostPage.getByRole("button", { name: "Host a room" }).click();
  await hostPage.locator('#host-avatar-picker .avatar-option[data-avatar="yellow"]').click();
  await hostPage.getByRole("button", { name: "Continue" }).click();
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  const roomCode = (await hostPage.locator("#room-code").textContent())?.trim() || "";

  await guestPage.goto("http://127.0.0.1:3000/");
  await guestPage.getByRole("tab", { name: "Online" }).click();
  await guestPage.getByRole("button", { name: "Join a room" }).click();
  await guestPage.locator("#join-code").fill(roomCode);
  await guestPage.getByRole("button", { name: "Continue" }).click();
  await guestPage.locator('#join-avatar-picker .avatar-option[data-avatar="green"]').click();
  await guestPage.getByRole("button", { name: "Join room" }).click();
  await expect(guestPage.locator("#screen-lobby.active")).toBeVisible();

  await hostPage.getByRole("button", { name: "Pick a game" }).click();
  await guestPage.getByRole("button", { name: "Pick a game" }).click();
  await hostPage.getByRole("button", { name: "Play Tic Tac Toe" }).click();
  await guestPage.getByRole("button", { name: "Play Tic Tac Toe" }).click();
  await expect(hostPage.locator("#screen-game.active")).toBeVisible();

  await hostPage.getByRole("button", { name: "Exit" }).click();
  await expect(hostPage.locator("#screen-landing.active")).toBeVisible();
  await hostPage.waitForTimeout(800);
  await expect(hostPage.locator("#screen-landing.active")).toBeVisible();
  await expect.poll(() => new URL(hostPage.url()).hash).toMatch(/^(|#landing)$/);

  await hostContext.close();
  await guestContext.close();
});
