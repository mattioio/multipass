import { expect, test } from "@playwright/test";

test("local happy path: setup -> lobby -> pick -> shuffle -> game", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("#screen-local.active")).toBeVisible();

  const localContinue = page.getByRole("button", { name: "Pick a player" });
  await expect(localContinue).toBeDisabled();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="yellow"]').click();
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#screen-local.active")).toBeVisible();
  await expect(page.locator("#local-step-title")).toHaveText("Player 2 choice");
  await expect(localContinue).toBeDisabled();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="green"]').click();
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.locator("#screen-lobby.active")).toBeVisible();
  await page.getByRole("button", { name: "Pick a game" }).click();

  await expect(page.locator("#screen-pick.active")).toBeVisible();
  await page.getByRole("button", { name: "Play Tic Tac Toe", exact: true }).click();

  await expect(page.locator("#screen-shuffle.active")).toBeVisible();
  await page.locator("#shuffle-spin").click();

  await expect(page.locator("#screen-game.active")).toBeVisible();
  await expect(page.locator("#ttt-board .ttt-cell")).toHaveCount(9);
});

test("local non-default registry game: pick -> shuffle -> game", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("#screen-local.active")).toBeVisible();

  await expect(page.getByRole("button", { name: "Pick a player" })).toBeDisabled();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="yellow"]').click();
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: "Pick a player" })).toBeDisabled();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="green"]').click();
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#screen-lobby.active")).toBeVisible();

  await page.getByRole("button", { name: "Pick a game" }).click();
  await expect(page.locator("#screen-pick.active")).toBeVisible();
  await page.getByRole("button", { name: "Play Tic Tac Toe Blitz" }).click();

  await expect(page.locator("#screen-shuffle.active")).toBeVisible();
  await page.locator("#shuffle-spin").click();
  await expect(page.locator("#screen-game.active")).toBeVisible();
  await expect(page.locator("#ttt-board .ttt-cell")).toHaveCount(9);
});
