import { expect, test } from "@playwright/test";

test("local happy path: setup -> lobby -> pick -> shuffle -> game", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("#screen-local.active")).toBeVisible();

  await page.locator('#local-fruit-grid .fruit-option[data-fruit="banana"]').click();
  await page.locator('#local-fruit-grid .fruit-option[data-fruit="kiwi"]').click();

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

  await page.locator('#local-fruit-grid .fruit-option[data-fruit="banana"]').click();
  await page.locator('#local-fruit-grid .fruit-option[data-fruit="kiwi"]').click();
  await expect(page.locator("#screen-lobby.active")).toBeVisible();

  await page.getByRole("button", { name: "Pick a game" }).click();
  await expect(page.locator("#screen-pick.active")).toBeVisible();
  await page.getByRole("button", { name: "Play Tic Tac Toe Blitz" }).click();

  await expect(page.locator("#screen-shuffle.active")).toBeVisible();
  await page.locator("#shuffle-spin").click();
  await expect(page.locator("#screen-game.active")).toBeVisible();
  await expect(page.locator("#ttt-board .ttt-cell")).toHaveCount(9);
});
