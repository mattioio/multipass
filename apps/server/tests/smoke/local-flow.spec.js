import { expect, test } from "@playwright/test";

async function getPseudoRotationDegrees(locator, pseudo = "::before") {
  const transform = await locator.evaluate((node, targetPseudo) => getComputedStyle(node, targetPseudo).transform, pseudo);
  if (!transform || transform === "none") return 0;

  const match = transform.match(/matrix\(([^)]+)\)/);
  if (!match) throw new Error(`Unsupported transform value: ${transform}`);

  const parts = match[1].split(",").map((value) => Number.parseFloat(value.trim()));
  const [a, b] = parts;
  const rawAngle = (Math.atan2(b, a) * 180) / Math.PI;
  return ((Math.round(rawAngle) % 360) + 360) % 360;
}

test("local happy path: setup -> lobby -> pick -> game", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__multipassLegacyReady === true);

  const landingStartCta = page.getByRole("button", { name: "Start" });
  const landingCtaBg = await landingStartCta.evaluate((node) => getComputedStyle(node).backgroundColor);
  const landingDevTagStyles = await page.evaluate(() => {
    const tag = document.getElementById("dev-build-tag");
    if (!(tag instanceof HTMLElement)) return null;
    const styles = getComputedStyle(tag);
    return { color: styles.color, backgroundColor: styles.backgroundColor };
  });

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("#screen-local.active")).toBeVisible();
  const pickerAvatarNameWeight = await page.locator('#local-avatar-grid .avatar-option[data-avatar="yellow"] .avatar-name').evaluate((node) => {
    return getComputedStyle(node).fontWeight;
  });
  const pickerYellowRotation = await getPseudoRotationDegrees(
    page.locator('#local-avatar-grid .avatar-option[data-avatar="yellow"] .avatar-shell')
  );
  const pickerRedRotation = await getPseudoRotationDegrees(
    page.locator('#local-avatar-grid .avatar-option[data-avatar="red"] .avatar-shell')
  );
  const pickerGreenRotation = await getPseudoRotationDegrees(
    page.locator('#local-avatar-grid .avatar-option[data-avatar="green"] .avatar-shell')
  );
  const pickerBlueRotation = await getPseudoRotationDegrees(
    page.locator('#local-avatar-grid .avatar-option[data-avatar="blue"] .avatar-shell')
  );
  expect(pickerYellowRotation).toBe(0);
  expect(pickerRedRotation).toBe(90);
  expect(pickerGreenRotation).toBe(180);
  expect(pickerBlueRotation).toBe(270);

  const localContinue = page.getByRole("button", { name: "Pick a player" });
  await expect(localContinue).toBeDisabled();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="yellow"]').click();
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#screen-local.active")).toBeVisible();
  await expect(page.locator("#local-step-title")).toHaveText("Player 2 choice");
  const mirroredP2LowerThirdStyle = await page.locator('#local-avatar-grid .avatar-option[data-avatar="green"] .avatar-lower-third').evaluate((node) => {
    const styles = getComputedStyle(node);
    return {
      right: styles.right,
      borderTopLeftRadius: styles.borderTopLeftRadius,
      borderTopRightRadius: styles.borderTopRightRadius,
      textAlign: styles.textAlign
    };
  });
  expect(mirroredP2LowerThirdStyle.right).toBe("0px");
  expect(mirroredP2LowerThirdStyle.borderTopLeftRadius).toBe("8px");
  expect(mirroredP2LowerThirdStyle.borderTopRightRadius).toBe("0px");
  expect(mirroredP2LowerThirdStyle.textAlign).toBe("right");
  const lockedP1LowerThirdStyle = await page.locator('#local-avatar-grid .avatar-option[data-avatar="yellow"] .avatar-lower-third').evaluate((node) => {
    const styles = getComputedStyle(node);
    return {
      left: styles.left,
      borderTopLeftRadius: styles.borderTopLeftRadius,
      borderTopRightRadius: styles.borderTopRightRadius,
      textAlign: styles.textAlign
    };
  });
  expect(lockedP1LowerThirdStyle.left).toBe("0px");
  expect(lockedP1LowerThirdStyle.borderTopLeftRadius).toBe("0px");
  expect(lockedP1LowerThirdStyle.borderTopRightRadius).toBe("8px");
  expect(lockedP1LowerThirdStyle.textAlign).toBe("left");
  await expect(localContinue).toBeDisabled();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="green"]').click();
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.locator("#screen-lobby.active")).toBeVisible();
  await expect.poll(async () => page.evaluate(() => document.body.getAttribute("data-theme"))).toBeNull();
  const lobbyPickGameCta = page.getByRole("button", { name: "Pick a game" });
  const lobbyCtaBg = await lobbyPickGameCta.evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(lobbyCtaBg).toBe(landingCtaBg);
  const lobbyDevTagStyles = await page.evaluate(() => {
    const tag = document.getElementById("dev-build-tag");
    if (!(tag instanceof HTMLElement)) return null;
    const styles = getComputedStyle(tag);
    return { color: styles.color, backgroundColor: styles.backgroundColor };
  });
  if (landingDevTagStyles && lobbyDevTagStyles) {
    expect(lobbyDevTagStyles).toEqual(landingDevTagStyles);
  }
  await expect(page.locator("#score-columns .score-duel-panel")).toHaveCount(1);
  await expect(page.locator("#score-columns .score-duel-side")).toHaveCount(2);
  await expect(page.locator("#score-columns .score-duel-scorebar-wrap")).toHaveCount(1);
  await expect(page.locator("#score-columns .score-broadcast-row")).toHaveCount(1);
  await expect(page.locator("#score-columns .score-role")).toHaveCount(0);
  await expect(page.locator("#score-columns .score-column")).toHaveCount(0);
  const lobbyHostScoreRotationVar = await page
    .locator("#score-columns .score-duel-side:not(.score-duel-side-guest) .player-card-shell--score")
    .evaluate((node) => getComputedStyle(node).getPropertyValue("--avatar-pattern-rotation").trim());
  const lobbyGuestScoreRotationVar = await page
    .locator("#score-columns .score-duel-side-guest .player-card-shell--score")
    .evaluate((node) => getComputedStyle(node).getPropertyValue("--avatar-pattern-rotation").trim());
  expect(lobbyHostScoreRotationVar).toBe("0deg");
  expect(lobbyGuestScoreRotationVar).toBe("180deg");
  const guestScoreLowerThirdStyle = await page.locator("#score-columns .score-duel-side-guest .player-card-lower-third--score").first().evaluate((node) => {
    const styles = getComputedStyle(node);
    return {
      right: styles.right,
      borderTopLeftRadius: styles.borderTopLeftRadius,
      borderTopRightRadius: styles.borderTopRightRadius,
      textAlign: styles.textAlign
    };
  });
  expect(guestScoreLowerThirdStyle.right).toBe("0px");
  expect(guestScoreLowerThirdStyle.borderTopLeftRadius).toBe("14px");
  expect(guestScoreLowerThirdStyle.borderTopRightRadius).toBe("0px");
  expect(guestScoreLowerThirdStyle.textAlign).toBe("right");
  const lobbyScoreNameWeight = await page.locator("#score-columns .player-card-name--score").first().evaluate((node) => {
    return getComputedStyle(node).fontWeight;
  });
  expect(lobbyScoreNameWeight).toBe(pickerAvatarNameWeight);
  await page.getByRole("button", { name: "Pick a game" }).click();

  await expect(page.locator("#screen-pick.active")).toBeVisible();
  await page.getByRole("button", { name: "Play Tic Tac Toe", exact: true }).click();

  await expect(page.locator("#screen-game.active")).toBeVisible();
  await expect(page.locator("#screen-game .game-surface-head")).toHaveCount(0);
  await expect(page.locator("#screen-game .game-surface-title")).toHaveCount(0);
  await expect(page.locator("#screen-game .game-surface-status")).toHaveCount(0);
  await expect(page.locator("#turn-indicator .turn-player")).toHaveCount(2);
  await expect(page.locator("#turn-indicator .turn-player-score-match")).toHaveCount(0);
  await expect(page.locator("#turn-indicator .turn-player-score-game")).toHaveCount(0);
  const firstRoundStarter = await page.evaluate(() => {
    const room = window.__multipassStore.getState().room;
    return {
      firstPlayerId: room.round?.firstPlayerId || null,
      hostId: room.players?.host?.id || null
    };
  });
  expect(firstRoundStarter.firstPlayerId).toBe(firstRoundStarter.hostId);
  await expect(page.locator("#ttt-board .ttt-cell")).toHaveCount(9);
  await expect(page.locator("#ttt-board")).toHaveClass(/game-board-highlight/);
  await expect(page.locator("#ttt-board")).toHaveClass(/theme-(red|yellow|green|blue)/);

  await page.locator("#ttt-board .ttt-cell").nth(0).click();
  await page.locator("#ttt-board .ttt-cell").nth(3).click();
  await page.locator("#ttt-board .ttt-cell").nth(1).click();
  await page.locator("#ttt-board .ttt-cell").nth(4).click();
  await page.locator("#ttt-board .ttt-cell").nth(2).click();

  await expect(page.locator("#screen-game.active")).toBeVisible();
  await expect(page.locator("#game-result-panel")).toHaveClass(/hidden/);
  await expect(page.locator("#ttt-board .ttt-cell.is-win-reason")).toHaveCount(3);
  await expect(page.locator("#game-result-panel:not(.hidden)")).toBeVisible({ timeout: 6000 });
  await expect(page.locator("#winner-hero .player-card-shell--score")).toHaveCount(1);
  await expect(page.locator("#winner-score-columns")).toHaveCount(0);
  await expect(page.locator("#ttt-board .ttt-cell.is-win-reason")).toHaveCount(0);
  await expect(page.locator("#ttt-board .ttt-cell.is-winning")).toHaveCount(3);

  await page.locator("#winner-play-again").click();
  await expect(page.locator("#screen-pick.active")).toBeVisible();
  const secondRoundStarter = await page.evaluate(() => {
    const room = window.__multipassStore.getState().room;
    return {
      firstPlayerId: room.round?.firstPlayerId || null,
      guestId: room.players?.guest?.id || null
    };
  });
  expect(secondRoundStarter.firstPlayerId).toBe(secondRoundStarter.guestId);
});

test("local tic-tac-toe supports touch drag preview + release, tap, and cancel", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForFunction(() => window.__multipassLegacyReady === true);

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("#screen-local.active")).toBeVisible();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="yellow"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="green"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#screen-lobby.active")).toBeVisible();

  await page.getByRole("button", { name: "Pick a game" }).click();
  await expect(page.locator("#screen-pick.active")).toBeVisible();
  await page.getByRole("button", { name: "Play Tic Tac Toe", exact: true }).click();
  await expect(page.locator("#screen-game.active")).toBeVisible();

  const board = page.locator("#ttt-board");
  const cells = board.locator(".ttt-cell");
  await expect(cells).toHaveCount(9);

  const getCellCenter = async (index) => {
    const box = await cells.nth(index).boundingBox();
    if (!box) throw new Error(`Missing bounding box for ttt cell ${index}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };

  const center0 = await getCellCenter(0);
  await cells.nth(0).dispatchEvent("pointerdown", {
    pointerId: 1001,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: center0.x,
    clientY: center0.y
  });
  await board.dispatchEvent("pointermove", {
    pointerId: 1001,
    pointerType: "touch",
    isPrimary: true,
    buttons: 1,
    clientX: center0.x + 180,
    clientY: center0.y + 180
  });
  await board.dispatchEvent("pointercancel", {
    pointerId: 1001,
    pointerType: "touch",
    isPrimary: true,
    clientX: center0.x + 180,
    clientY: center0.y + 180
  });
  await expect(cells.nth(0).locator(".ttt-mark")).toHaveCount(0);

  const center1 = await getCellCenter(1);
  await cells.nth(0).dispatchEvent("pointerdown", {
    pointerId: 1002,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: center0.x,
    clientY: center0.y
  });
  await board.dispatchEvent("pointermove", {
    pointerId: 1002,
    pointerType: "touch",
    isPrimary: true,
    buttons: 1,
    clientX: center1.x,
    clientY: center1.y
  });
  await board.dispatchEvent("pointerup", {
    pointerId: 1002,
    pointerType: "touch",
    isPrimary: true,
    clientX: center1.x,
    clientY: center1.y
  });
  await expect(cells.nth(1).locator(".ttt-mark")).toHaveCount(1);

  const center3 = await getCellCenter(3);
  await cells.nth(3).dispatchEvent("pointerdown", {
    pointerId: 1003,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: center3.x,
    clientY: center3.y
  });
  await board.dispatchEvent("pointerup", {
    pointerId: 1003,
    pointerType: "touch",
    isPrimary: true,
    clientX: center3.x,
    clientY: center3.y
  });
  await expect(cells.nth(3).locator(".ttt-mark")).toHaveCount(1);
});

test("landing supports swipe between local and online modes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForFunction(() => window.__multipassLegacyReady === true);

  const carousel = page.locator(".landing-carousel");
  const box = await carousel.boundingBox();
  if (!box) throw new Error("Landing carousel is not visible");

  const startX = box.x + box.width * 0.78;
  const endLeftX = box.x + box.width * 0.2;
  const endRightX = box.x + box.width * 0.8;
  const centerY = box.y + box.height * 0.5;

  await carousel.dispatchEvent("pointerdown", {
    pointerId: 1101,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: startX,
    clientY: centerY
  });
  await carousel.dispatchEvent("pointermove", {
    pointerId: 1101,
    pointerType: "touch",
    isPrimary: true,
    buttons: 1,
    clientX: endLeftX,
    clientY: centerY
  });
  await carousel.dispatchEvent("pointerup", {
    pointerId: 1101,
    pointerType: "touch",
    isPrimary: true,
    clientX: endLeftX,
    clientY: centerY
  });
  await expect(page.locator("#landing-tab-online")).toHaveAttribute("aria-selected", "true");

  await carousel.dispatchEvent("pointerdown", {
    pointerId: 1102,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: endLeftX,
    clientY: centerY
  });
  await carousel.dispatchEvent("pointermove", {
    pointerId: 1102,
    pointerType: "touch",
    isPrimary: true,
    buttons: 1,
    clientX: endRightX,
    clientY: centerY
  });
  await carousel.dispatchEvent("pointerup", {
    pointerId: 1102,
    pointerType: "touch",
    isPrimary: true,
    clientX: endRightX,
    clientY: centerY
  });
  await expect(page.locator("#landing-tab-local")).toHaveAttribute("aria-selected", "true");

  await page.waitForTimeout(320);
  await page.getByRole("tab", { name: "Online" }).click();
  await expect(page.locator("#landing-tab-online")).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Local" }).click();
  await expect(page.locator("#landing-tab-local")).toHaveAttribute("aria-selected", "true");
});

test("local honorific picker is per-player", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__multipassLegacyReady === true);
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("#screen-local.active")).toBeVisible();

  await page.locator("#local-honorific-toolbar .switch").click();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="yellow"]').click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.locator("#local-step-title")).toHaveText("Player 2 choice");
  await expect(page.locator("#local-honorific-toggle")).not.toBeChecked();
  const lockedYellowTile = page.locator('#local-avatar-grid .avatar-option.p1-locked[data-avatar="yellow"]');
  const redTileArt = page.locator('#local-avatar-grid .avatar-option[data-avatar="red"] .player-art img');
  await expect(lockedYellowTile).toBeVisible();
  await expect(lockedYellowTile.locator(".avatar-name")).toHaveText("Mrs Yellow");
  await expect(page.locator('#local-avatar-grid .avatar-option[data-avatar="red"] .avatar-name')).toHaveText("Mr Red");
  const lockedTransform = await lockedYellowTile.locator(".player-art img").evaluate((node) => getComputedStyle(node).transform);
  const redTransform = await redTileArt.evaluate((node) => getComputedStyle(node).transform);
  const isMirrored = (value) => typeof value === "string" && value.includes("-1");
  expect(isMirrored(lockedTransform)).toBe(false);
  expect(isMirrored(redTransform)).toBe(true);

  const lockedSrc = await lockedYellowTile.locator(".player-art img").getAttribute("src");
  const redMrSrc = await redTileArt.getAttribute("src");
  expect(lockedSrc).toBeTruthy();
  expect(redMrSrc).toBeTruthy();
  expect(lockedSrc).not.toBe(redMrSrc);

  await page.locator("#local-honorific-toolbar .switch").click();
  await expect(page.locator("#local-honorific-toggle")).toBeChecked();
  await expect(page.locator('#local-avatar-grid .avatar-option[data-avatar="red"] .avatar-name')).toHaveText("Mrs Red");
  await expect(lockedYellowTile.locator(".avatar-name")).toHaveText("Mrs Yellow");
  const redMrsSrc = await redTileArt.getAttribute("src");
  const lockedSrcWhileP2Mrs = await lockedYellowTile.locator(".player-art img").getAttribute("src");
  expect(redMrsSrc).toBeTruthy();
  expect(lockedSrcWhileP2Mrs).toBe(lockedSrc);
  expect(redMrsSrc).toBe(lockedSrc);

  await page.locator("#local-honorific-toolbar .switch").click();
  await expect(page.locator("#local-honorific-toggle")).not.toBeChecked();
  await expect(page.locator('#local-avatar-grid .avatar-option[data-avatar="red"] .avatar-name')).toHaveText("Mr Red");
  await expect(lockedYellowTile.locator(".avatar-name")).toHaveText("Mrs Yellow");
  const redMrSrcAgain = await redTileArt.getAttribute("src");
  const lockedSrcAfterToggleBack = await lockedYellowTile.locator(".player-art img").getAttribute("src");
  expect(redMrSrcAgain).toBe(redMrSrc);
  expect(lockedSrcAfterToggleBack).toBe(lockedSrc);
  expect(lockedSrcAfterToggleBack).not.toBe(redMrSrcAgain);

  await page.locator('#local-avatar-grid .avatar-option[data-avatar="green"]').click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.locator("#screen-lobby.active")).toBeVisible();
  await expect(page.locator("#score-columns")).toContainText("Mrs Yellow");
  await expect(page.locator("#score-columns")).toContainText("Mr Green");
});

test("battleships uses a single board with tap-then-confirm fire", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__multipassLegacyReady === true);

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("#screen-local.active")).toBeVisible();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="yellow"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="green"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#screen-lobby.active")).toBeVisible();

  await page.getByRole("button", { name: "Pick a game" }).click();
  await expect(page.locator("#screen-pick.active")).toBeVisible();
  await page.getByRole("button", { name: "Play Battleships" }).click();
  await expect(page.locator("#screen-game.active")).toBeVisible();
  await expect(page.locator("#screen-game .game-surface-head")).toHaveCount(0);
  await expect(page.locator("#screen-game .game-surface-title")).toHaveCount(0);
  await expect(page.locator("#screen-game .game-surface-status")).toHaveCount(0);
  await expect(page.locator("#turn-indicator .turn-player")).toHaveCount(2);

  await expect(page.locator("#battleship-layout")).not.toHaveClass(/hidden/);
  await expect(page.locator("#battleship-own-board .battleship-cell")).toHaveCount(36);
  await expect(page.locator("#battleship-target-board")).toHaveCount(0);
  await expect(page.locator("#battleship-view-own")).toHaveCount(0);
  await expect(page.locator("#battleship-view-target")).toHaveCount(0);
  await expect(page.locator("#battleship-own-card")).toHaveClass(/game-board-highlight/);
  await expect(page.locator("#battleship-action-row")).toHaveClass(/hidden/);

  const placeShipAndPass = async (index) => {
    await page.locator(`#battleship-own-board .battleship-cell[data-index="${index}"]`).click();
    await expect(page.locator("#screen-pass.active")).toBeVisible();
    await page.locator("#pass-ready").click();
    await expect(page.locator("#screen-game.active")).toBeVisible();
  };

  await placeShipAndPass(0);
  await placeShipAndPass(12);
  await placeShipAndPass(6);
  await placeShipAndPass(18);

  await expect(page.locator("#battleship-action-row")).not.toHaveClass(/hidden/);
  const historyBefore = await page.evaluate(() => window.__multipassStore.getState().room.game.state.shotHistory.length);

  await page.locator('#battleship-own-board .battleship-cell[data-index="5"]').click();
  await expect(page.locator('#battleship-own-board .battleship-cell[data-index="5"]')).toHaveClass(/is-pending-target/);
  await expect(page.locator("#battleship-fire-target")).toHaveText(/Fire at [A-F][1-6]/);
  await expect(page.locator("#screen-game.active")).toBeVisible();
  const historyAfterStage = await page.evaluate(() => window.__multipassStore.getState().room.game.state.shotHistory.length);
  expect(historyAfterStage).toBe(historyBefore);

  await page.locator("#battleship-clear-target").click();
  await expect(page.locator('#battleship-own-board .battleship-cell[data-index="5"]')).not.toHaveClass(/is-pending-target/);
  await expect(page.locator("#battleship-fire-target")).toHaveText("Fire");
  const historyAfterClear = await page.evaluate(() => window.__multipassStore.getState().room.game.state.shotHistory.length);
  expect(historyAfterClear).toBe(historyBefore);

  await page.locator('#battleship-own-board .battleship-cell[data-index="7"]').click();
  await expect(page.locator('#battleship-own-board .battleship-cell[data-index="7"]')).toHaveClass(/is-pending-target/);
  await page.locator("#battleship-fire-target").click();
  await expect(page.locator("#screen-pass.active")).toBeVisible();
  const historyAfterFire = await page.evaluate(() => window.__multipassStore.getState().room.game.state.shotHistory.length);
  expect(historyAfterFire).toBe(historyBefore + 1);
});

test("dots and boxes keeps turn on box completion and reaches winner overlay", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__multipassLegacyReady === true);

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("#screen-local.active")).toBeVisible();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="yellow"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="green"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#screen-lobby.active")).toBeVisible();

  await page.getByRole("button", { name: "Pick a game" }).click();
  await expect(page.locator("#screen-pick.active")).toBeVisible();
  await page.getByRole("button", { name: "Play Dots & Boxes" }).click();
  await expect(page.locator("#screen-game.active")).toBeVisible();
  await expect(page.locator("#dots-layout")).not.toHaveClass(/hidden/);
  await expect(page.locator("#dots-board .dots-edge")).toHaveCount(60);
  await expect(page.locator("#dots-board .dots-box")).toHaveCount(25);
  await expect(page.locator("#dots-board .dots-edge.is-playable")).toHaveCount(60);
  await expect(page.locator("#turn-indicator .turn-player-score-match")).toHaveCount(0);
  await expect(page.locator("#turn-indicator .turn-player-score-game")).toHaveCount(2);
  const mirrorLayout = await page.evaluate(() => {
    const guestPane = document.querySelector("#turn-indicator .turn-player-guest");
    const guestMeta = document.querySelector("#turn-indicator .turn-player-guest .turn-player-meta");
    if (!(guestPane instanceof HTMLElement) || !(guestMeta instanceof HTMLElement)) return null;
    return {
      guestFlexDirection: getComputedStyle(guestPane).flexDirection,
      guestMetaTextAlign: getComputedStyle(guestMeta).textAlign
    };
  });
  expect(mirrorLayout).not.toBeNull();
  expect(mirrorLayout?.guestFlexDirection).toBe("row-reverse");
  expect(mirrorLayout?.guestMetaTextAlign).toBe("right");

  const [hostId, guestId] = await page.evaluate(() => {
    const room = window.__multipassStore.getState().room;
    return [room.players.host.id, room.players.guest.id];
  });

  const clickEdge = async (edgeIndex) => {
    await page.locator(`#dots-board .dots-edge[data-edge-index="${edgeIndex}"]`).click();
  };

  await clickEdge(0);
  await clickEdge(10);
  await clickEdge(30);
  await clickEdge(11);
  await clickEdge(5);
  await clickEdge(12);
  await expect(page.locator('#dots-board .dots-edge[data-edge-index="31"]')).toHaveClass(/is-scoring-opportunity/);
  await clickEdge(31);
  await expect(page.locator("#dots-board .dots-edge.is-last-move")).toHaveCount(1);

  const afterScoringMove = await page.evaluate(() => {
    const room = window.__multipassStore.getState().room;
    return {
      nextPlayerId: room.game.state.nextPlayerId,
      boxOwner: room.game.state.boxes[0],
      scores: room.game.state.scores
    };
  });
  expect(afterScoringMove.nextPlayerId).toBe(hostId);
  expect(afterScoringMove.boxOwner).toBe(hostId);
  expect(afterScoringMove.scores[hostId]).toBe(1);
  expect(afterScoringMove.scores[guestId]).toBe(0);
  await expect(page.locator("#turn-indicator .turn-player-host .turn-player-score-game")).toHaveText("1");

  const prePlayedEdges = new Set([0, 10, 30, 11, 5, 12, 31]);
  for (let edgeIndex = 0; edgeIndex < 60; edgeIndex += 1) {
    if (prePlayedEdges.has(edgeIndex)) continue;
    await clickEdge(edgeIndex);
  }

  await expect(page.locator("#game-result-panel:not(.hidden)")).toBeVisible({ timeout: 9000 });
  await expect(page.locator("#turn-indicator .turn-player-score-match")).toHaveCount(0);
});

test("local poker dice banks points immediately and swaps to pass-only CTA at end of turn", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__multipassLegacyReady === true);

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("#screen-local.active")).toBeVisible();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="yellow"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="green"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#screen-lobby.active")).toBeVisible();

  await page.getByRole("button", { name: "Pick a game" }).click();
  await expect(page.locator("#screen-pick.active")).toBeVisible();
  await page.getByRole("button", { name: "Play Poker Dice" }).click();
  await expect(page.locator("#screen-game.active")).toBeVisible();
  await expect(page.locator("#poker-dice-layout")).not.toHaveClass(/hidden/);
  await expect(page.locator("#poker-dice-dice .poker-die")).toHaveCount(6);

  await expect(page.locator("#poker-dice-pass-play")).toHaveClass(/hidden/);
  await expect(page.locator("#poker-dice-roll")).not.toHaveClass(/hidden/);
  await expect(page.locator("#poker-dice-bank")).not.toHaveClass(/hidden/);
  await expect(page.locator("#poker-dice-clear-hold")).not.toHaveClass(/hidden/);

  await page.locator("#poker-dice-roll").click();
  await expect(page.locator("#poker-dice-bank")).toBeEnabled({ timeout: 6000 });
  await page.locator("#poker-dice-bank").click();

  await expect(page.locator("#poker-dice-pass-play")).not.toHaveClass(/hidden/);
  await expect(page.locator("#poker-dice-roll")).toHaveClass(/hidden/);
  await expect(page.locator("#poker-dice-bank")).toHaveClass(/hidden/);
  await expect(page.locator("#poker-dice-clear-hold")).toHaveClass(/hidden/);

  const bankedSnapshot = await page.evaluate(() => {
    const appState = window.__multipassStore.getState();
    const viewerId = appState.localPrivacy.viewerPlayerId;
    const gameState = appState.room.game.state;
    const final = gameState.currentHand.finalByPlayer[viewerId];
    return {
      viewerId,
      bankedPoints: final?.bankedPoints ?? null,
      pointsAfterBank: final?.pointsAfterBank ?? null,
      pointsByPlayer: gameState.pointsByPlayer?.[viewerId] ?? null,
      nextPlayerId: gameState.nextPlayerId || null
    };
  });

  expect(bankedSnapshot.bankedPoints).not.toBeNull();
  expect(bankedSnapshot.pointsAfterBank).toBe(bankedSnapshot.pointsByPlayer);
  expect(bankedSnapshot.pointsAfterBank).toBeGreaterThanOrEqual(0);
  expect(bankedSnapshot.nextPlayerId).not.toBe(bankedSnapshot.viewerId);

  await page.locator("#poker-dice-pass-play").click();
  await expect(page.locator("#poker-dice-roll")).not.toHaveClass(/hidden/);
  await expect(page.locator("#poker-dice-pass-play")).toHaveClass(/hidden/);

  const afterPassViewer = await page.evaluate(() => {
    const appState = window.__multipassStore.getState();
    return appState.localPrivacy.viewerPlayerId;
  });
  expect(afterPassViewer).toBe(bankedSnapshot.nextPlayerId);
});

test("local lobby duel sides remain side-by-side on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForFunction(() => window.__multipassLegacyReady === true);

  await page.getByRole("button", { name: "Start" }).click();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="yellow"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="blue"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#screen-lobby.active")).toBeVisible();

  await expect(page.locator("#score-columns .score-duel-side")).toHaveCount(2);
  await expect(page.locator("#app-fixed-footer")).not.toHaveClass(/hidden/);
  await expect(page.locator("#app-dock-slot-lobby")).not.toHaveClass(/hidden/);
  const heroPosition = await page.locator(".hero").evaluate((node) => getComputedStyle(node).position);
  expect(heroPosition).toBe("sticky");

  const layout = await page.locator("#score-columns .score-duel-sides").evaluate((node) => {
    const sides = Array.from(node.querySelectorAll(".score-duel-side"));
    const [left, right] = sides.map((side) => side.getBoundingClientRect());
    return {
      sameRow: Math.abs(left.top - right.top) < 6,
      separated: right.left - left.left > 20
    };
  });

  expect(layout.sameRow).toBeTruthy();
  expect(layout.separated).toBeTruthy();

  await page.locator("#app-dock-lobby-ready").click();
  await expect(page.locator("#screen-pick.active")).toBeVisible();
  await expect(page.locator("#app-fixed-footer")).toHaveClass(/hidden/);
});

test("local pick can launch word fight module", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__multipassLegacyReady === true);

  await page.getByRole("button", { name: "Start" }).click();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="yellow"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="green"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#screen-lobby.active")).toBeVisible();

  await page.getByRole("button", { name: "Pick a game" }).click();
  await expect(page.locator("#screen-pick.active")).toBeVisible();
  await page.getByRole("button", { name: "Play Word Fight", exact: true }).click();

  await expect(page.locator("#screen-game.active")).toBeVisible();
  await expect(page.locator("#word-fight-layout")).not.toHaveClass(/hidden/);
  await expect(page.locator("#word-fight-secret")).toHaveCount(0);
  await expect(page.locator("#word-fight-draft-row")).toHaveCount(0);
  await expect(page.locator("#word-fight-keyboard")).toBeVisible();
  await expect(page.locator('#word-fight-keyboard [data-word-fight-key="T"]')).toBeVisible();
  await expect(page.locator("#word-fight-status")).toBeHidden();
  await expect(page.locator("#word-fight-active-board .word-fight-row")).toHaveCount(5);
  await expect(page.locator("#word-fight-you-board")).toHaveCount(0);
  await expect(page.locator("#word-fight-opponent-board")).toHaveCount(0);
  await expect(page.locator("#turn-indicator .turn-player-host")).toHaveClass(/is-active/);
  await expect(page.locator("#turn-indicator .turn-player-guest")).toHaveClass(/is-inactive/);
  await expect(page.locator("#turn-indicator .turn-player-host .turn-player-score-game")).toHaveText("0");
  await expect(page.locator("#turn-indicator .turn-player-guest .turn-player-score-game")).toHaveText("0");

  await page.locator('#word-fight-keyboard [data-word-fight-key="T"]').click();
  await page.locator('#word-fight-keyboard [data-word-fight-key="I"]').click();
  await page.locator('#word-fight-keyboard [data-word-fight-key="M"]').click();
  await page.locator('#word-fight-keyboard [data-word-fight-key="E"]').click();
  await expect(page.locator("#word-fight-active-board .word-fight-row").nth(0).locator(".word-fight-tile").nth(0)).toHaveText("T");
  await expect(page.locator("#word-fight-active-board .word-fight-row").nth(0).locator(".word-fight-tile").nth(1)).toHaveText("I");
  await expect(page.locator("#word-fight-active-board .word-fight-row").nth(0).locator(".word-fight-tile").nth(2)).toHaveText("M");
  await expect(page.locator("#word-fight-active-board .word-fight-row").nth(0).locator(".word-fight-tile").nth(3)).toHaveText("E");
  await page.locator('#word-fight-keyboard [data-word-fight-key="ENTER"]').click();

  await expect(page.locator("#screen-game.active")).toBeVisible();
  await expect(page.locator("#screen-pass.active")).toHaveCount(0);
  await expect(page.locator("#word-fight-keyboard")).toBeVisible();
  await expect(page.locator('#word-fight-keyboard [data-word-fight-key="T"]')).toBeDisabled();
  await expect(page.locator("#word-fight-actions")).not.toHaveClass(/hidden/);
  await expect(page.locator("#word-fight-pass-turn")).toBeVisible();
  await expect(page.locator("#word-fight-status")).toBeHidden();
  await expect(page.locator("#turn-indicator .turn-player-host")).toHaveClass(/is-active/);
  await expect(page.locator("#turn-indicator .turn-player-guest")).toHaveClass(/is-inactive/);
  const hostScoreAfterGuess = await page.locator("#turn-indicator .turn-player-host .turn-player-score-game").innerText();
  expect(Number.parseInt(hostScoreAfterGuess, 10)).toBeGreaterThanOrEqual(0);
  await expect(page.locator("#turn-indicator .turn-player-guest .turn-player-score-game")).toHaveText("0");

  await page.locator("#word-fight-pass-turn").click();
  await expect(page.locator("#word-fight-keyboard")).not.toHaveClass(/hidden/);
  await expect(page.locator("#word-fight-actions")).toHaveClass(/hidden/);
  await expect(page.locator("#turn-indicator .turn-player-host")).toHaveClass(/is-inactive/);
  await expect(page.locator("#turn-indicator .turn-player-guest")).toHaveClass(/is-active/);
  await expect(page.locator("#turn-indicator .turn-player-host .turn-player-score-game")).toHaveText(hostScoreAfterGuess);
  await expect(page.locator("#turn-indicator .turn-player-guest .turn-player-score-game")).toHaveText("0");
});
