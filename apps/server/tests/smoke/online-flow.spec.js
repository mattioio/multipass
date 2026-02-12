import { expect, test } from "@playwright/test";

test("online happy path: host + guest choose game -> shuffle/game", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  await hostPage.goto("http://127.0.0.1:3000/");
  await hostPage.getByRole("tab", { name: "Online" }).click();
  await hostPage.getByRole("button", { name: "Host a room" }).click();
  await hostPage.locator('#host-fruit-picker .fruit-option[data-fruit="banana"]').click();
  await hostPage.getByRole("button", { name: "Create room" }).click();

  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(hostPage.locator("#room-code")).toContainText(/[A-Z]{4}/);
  const roomCode = (await hostPage.locator("#room-code").textContent())?.trim() || "";

  await guestPage.goto("http://127.0.0.1:3000/");
  await guestPage.getByRole("tab", { name: "Online" }).click();
  await guestPage.getByRole("button", { name: "Join a room" }).click();
  await guestPage.locator("#join-code").fill(roomCode);
  await guestPage.getByRole("button", { name: "Continue" }).click();
  await guestPage.locator('#join-fruit-picker .fruit-option[data-fruit="kiwi"]').click();
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
