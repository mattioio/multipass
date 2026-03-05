import { expect, test } from "@playwright/test";

const WORD_FIGHT_GUESS_CANDIDATES = ["ABLE", "BARK", "CAMP", "DOVE", "FIRM", "GLAD", "HUNT", "JUMP", "LAMP", "MINT"];

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

async function enterWordFightGuess(page, guess) {
  const normalized = String(guess || "").toUpperCase();
  for (const letter of normalized) {
    await page.locator(`#word-fight-keyboard [data-word-fight-key="${letter}"]`).click();
  }
  await page.locator('#word-fight-keyboard [data-word-fight-key="ENTER"]').click();
}

test("local happy path: setup -> lobby -> game", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__multipassLegacyReady === true);

  const landingDevTagStyles = await page.evaluate(() => {
    const tag = document.getElementById("dev-build-tag");
    if (!(tag instanceof HTMLElement)) return null;
    const styles = getComputedStyle(tag);
    return { color: styles.color, backgroundColor: styles.backgroundColor };
  });

  await page.getByRole("button", { name: "Local" }).click();
  await expect(page.locator("#screen-local.active")).toBeVisible();
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
  await expect(page.locator("#score-columns .score-duel-meta")).toHaveCount(2);
  await expect(page.locator("#score-columns .score-duel-name")).toHaveCount(2);
  await expect(page.locator("#score-columns .score-duel-points")).toHaveCount(2);
  await expect(page.locator("#score-columns .score-duel-scorebar-wrap")).toHaveCount(0);
  await expect(page.locator("#score-columns .score-broadcast-row")).toHaveCount(0);
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
  await expect(page.locator("#score-columns .score-duel-side:not(.score-duel-side-guest) .score-duel-points")).toHaveText("0");
  await expect(page.locator("#score-columns .score-duel-side-guest .score-duel-points")).toHaveText("0");
  await page.getByRole("button", { name: "Play Tic Tac Toe", exact: true }).click();

  await expect(page.locator("#screen-game.active")).toBeVisible();
  await expect(page.locator("#screen-game .game-surface-head")).toHaveCount(0);
  await expect(page.locator("#screen-game .game-surface-title")).toHaveCount(0);
  await expect(page.locator("#screen-game .game-surface-status")).toHaveCount(0);
  await expect(page.locator("#turn-indicator .turn-pane")).toHaveCount(2);
  await expect(page.locator('#turn-indicator .turn-pane[data-side="host"] .turn-avatar')).toHaveCount(1);
  await expect(page.locator('#turn-indicator .turn-pane[data-side="guest"] .turn-avatar')).toHaveCount(1);
  await expect(page.locator("#turn-indicator .turn-meta")).toHaveCount(2);
  await expect(page.locator("#turn-indicator .turn-state")).toHaveCount(2);
  await expect(page.locator("#turn-indicator .turn-score-match")).toHaveCount(0);
  await expect(page.locator("#turn-indicator .turn-score-game")).toHaveCount(0);
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
  await expect(page.locator("#ttt-board .ttt-cell.is-win-reason")).toHaveCount(3);
  await expect(page.locator("#turn-indicator")).toHaveAttribute("data-mode", "winner");
  await expect(page.locator('#turn-indicator [data-side="host"]')).toHaveAttribute("data-active", "true");
  await expect(page.locator('#turn-indicator [data-side="guest"]')).toHaveAttribute("data-active", "false");
  await expect(page.locator("#turn-indicator .turn-player-cta")).toHaveCount(0);
  await expect(page.locator("#new-round")).toBeVisible();
  await expect(page.locator("#ttt-board .ttt-cell.is-win-reason")).toHaveCount(0);
  await expect(page.locator("#ttt-board .ttt-cell.is-winning")).toHaveCount(3);

  await page.locator("#new-round").click();
  await expect(page.locator("#screen-lobby.active")).toBeVisible();
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

  await page.getByRole("button", { name: "Local" }).click();
  await expect(page.locator("#screen-local.active")).toBeVisible();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="yellow"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="green"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#screen-lobby.active")).toBeVisible();
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

test("setup sheets and game sheet dismiss back to the expected layer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForFunction(() => window.__multipassLegacyReady === true);

  const readHomeChromeState = async () => page.evaluate(() => {
    const settings = document.getElementById("open-settings");
    const logoImage = document.querySelector(".logo-image");
    const centerTitle = document.getElementById("lobby-games-title");
    const logoContainer = document.querySelector(".logo");
    const leftAction = document.getElementById("hero-left-action");
    const isVisible = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      const styles = window.getComputedStyle(node);
      return styles.display !== "none" && styles.visibility !== "hidden" && styles.opacity !== "0";
    };
    const getCenterX = (node) => {
      if (!(node instanceof HTMLElement)) return null;
      const rect = node.getBoundingClientRect();
      return rect.left + (rect.width / 2);
    };
    return {
      settingsVisible: isVisible(settings),
      logoWidth: logoImage instanceof HTMLElement ? window.getComputedStyle(logoImage).width : "",
      leftActionVisible: isVisible(leftAction),
      leftActionLabel: leftAction instanceof HTMLElement ? leftAction.textContent?.trim() || "" : "",
      settingsX: getCenterX(settings),
      leftActionX: getCenterX(leftAction),
      centerTitleVisible: isVisible(centerTitle),
      centerLogoVisible: isVisible(logoImage),
      centerHasAction: Boolean(logoContainer?.querySelector("button")),
      viewportWidth: window.innerWidth
    };
  });

  const landingChrome = await readHomeChromeState();

  await page.getByRole("button", { name: "Online" }).click();
  await expect(page.locator("#screen-online.active")).toBeVisible();
  await expect(page.locator("#screen-landing.active")).toBeVisible();
  const onlineChrome = await readHomeChromeState();
  expect(onlineChrome.settingsVisible).toBe(landingChrome.settingsVisible);
  expect(onlineChrome.logoWidth).toBe(landingChrome.logoWidth);
  expect(Math.abs((onlineChrome.settingsX ?? 0) - (landingChrome.settingsX ?? 0))).toBeLessThanOrEqual(1);
  if (onlineChrome.leftActionVisible) {
    expect(onlineChrome.leftActionLabel).not.toMatch(/close|back/i);
  }
  await page.locator("#screen-online .setup-header-close").click();
  await expect(page.locator("#screen-online.is-closing")).toBeVisible();
  await expect(page.locator("#screen-online.active")).toHaveCount(0);
  await expect(page.locator("#screen-landing.active")).toBeVisible();

  await page.getByRole("button", { name: "Online" }).click();
  await expect(page.locator("#screen-online.active")).toBeVisible();
  await page.locator("#screen-online .sheet-backdrop").click();
  await expect(page.locator("#screen-online.is-closing")).toBeVisible();
  await expect(page.locator("#screen-online.active")).toHaveCount(0);
  await expect(page.locator("#screen-landing.active")).toBeVisible();

  await page.getByRole("button", { name: "Local" }).click();
  await expect(page.locator("#screen-local.active")).toBeVisible();
  const localChrome = await readHomeChromeState();
  expect(localChrome.settingsVisible).toBe(landingChrome.settingsVisible);
  expect(localChrome.logoWidth).toBe(landingChrome.logoWidth);
  expect(Math.abs((localChrome.settingsX ?? 0) - (landingChrome.settingsX ?? 0))).toBeLessThanOrEqual(1);
  if (localChrome.leftActionVisible) {
    expect(localChrome.leftActionLabel).not.toMatch(/close|back/i);
  }

  const localHandle = page.locator("#screen-local [data-sheet-handle='true']");
  const localHandleBox = await localHandle.boundingBox();
  if (!localHandleBox) throw new Error("Local sheet handle is not visible");
  const handleX = localHandleBox.x + localHandleBox.width / 2;
  const handleY = localHandleBox.y + localHandleBox.height / 2;

  await localHandle.dispatchEvent("pointerdown", {
    pointerId: 1100,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: handleX,
    clientY: handleY
  });
  await page.locator("#screen-local").dispatchEvent("pointermove", {
    pointerId: 1100,
    pointerType: "touch",
    isPrimary: true,
    buttons: 1,
    clientX: handleX,
    clientY: handleY + 36
  });
  await page.waitForTimeout(220);
  await page.locator("#screen-local").dispatchEvent("pointerup", {
    pointerId: 1100,
    pointerType: "touch",
    isPrimary: true,
    clientX: handleX,
    clientY: handleY + 36
  });
  await expect(page.locator("#screen-local.active")).toBeVisible();

  await localHandle.dispatchEvent("pointerdown", {
    pointerId: 1101,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: handleX,
    clientY: handleY
  });
  await page.locator("#screen-local .sheet-panel").dispatchEvent("pointermove", {
    pointerId: 1101,
    pointerType: "touch",
    isPrimary: true,
    buttons: 1,
    clientX: handleX,
    clientY: handleY + 180
  });
  await page.locator("#screen-local .sheet-panel").dispatchEvent("pointerup", {
    pointerId: 1101,
    pointerType: "touch",
    isPrimary: true,
    clientX: handleX,
    clientY: handleY + 180
  });
  await expect(page.locator("#screen-local.is-closing")).toBeVisible();
  await expect(page.locator("#screen-local.active")).toHaveCount(0);
  await expect(page.locator("#screen-local.is-closing")).toHaveCount(0);
  await expect(page.locator("#screen-landing.active")).toBeVisible();

  await page.getByRole("button", { name: "Local" }).click();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="yellow"]').click();
  const localContinueDock = page.locator("#app-dock-local-continue");
  await expect(localContinueDock).toBeVisible();
  await expect(localContinueDock).toBeEnabled();
  await localContinueDock.click();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="green"]').click();
  await expect(localContinueDock).toBeEnabled();
  await localContinueDock.click();
  await expect(page.locator("#screen-lobby.active")).toBeVisible();
  const lobbyChrome = await readHomeChromeState();
  expect(lobbyChrome.leftActionVisible).toBe(true);
  expect(lobbyChrome.settingsVisible).toBe(true);
  expect(lobbyChrome.centerTitleVisible).toBe(false);
  expect(lobbyChrome.centerLogoVisible).toBe(false);
  expect(lobbyChrome.centerHasAction).toBe(false);
  expect((lobbyChrome.leftActionX ?? 0) < ((lobbyChrome.viewportWidth ?? 0) / 3)).toBe(true);
  expect((lobbyChrome.settingsX ?? 0) > (((lobbyChrome.viewportWidth ?? 0) * 2) / 3)).toBe(true);
  await page.getByRole("button", { name: "Play Tic Tac Toe", exact: true }).click();
  await expect(page.locator("#screen-game.active")).toBeVisible();
  await expect(page.locator("#open-settings")).toBeHidden();
  await expect(page.locator("#screen-game #game-close-board")).toBeVisible();

  await page.locator("#screen-game #game-close-board").click();
  await expect(page.locator("#screen-lobby.active")).toBeVisible();
  await expect(page.locator("#screen-game.active")).toHaveCount(0);
});

test("local honorific picker is per-player", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__multipassLegacyReady === true);
  await page.getByRole("button", { name: "Local" }).click();
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

test("battleships is removed from picker and unsupported layout contract exists", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__multipassLegacyReady === true);

  await page.getByRole("button", { name: "Local" }).click();
  await expect(page.locator("#screen-local.active")).toBeVisible();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="yellow"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="green"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#screen-lobby.active")).toBeVisible();

  await expect(page.getByRole("button", { name: "Play Battleships" })).toHaveCount(0);
  await expect(page.locator("#game-list")).not.toContainText("Battleships");
  await expect(page.locator("#unsupported-game-layout")).toHaveCount(1);
  await expect(page.locator("#unsupported-game-title")).toHaveCount(1);
  await expect(page.locator("#unsupported-game-message")).toHaveCount(1);
});

test("dots and boxes keeps turn on box completion and reaches winner overlay", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__multipassLegacyReady === true);

  await page.getByRole("button", { name: "Local" }).click();
  await expect(page.locator("#screen-local.active")).toBeVisible();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="yellow"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="green"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#screen-lobby.active")).toBeVisible();
  await page.getByRole("button", { name: "Play Dots & Boxes" }).click();
  await expect(page.locator("#screen-game.active")).toBeVisible();
  await expect(page.locator("#dots-layout")).not.toHaveClass(/hidden/);
  await expect(page.locator("#dots-board .dots-edge")).toHaveCount(60);
  await expect(page.locator("#dots-board .dots-box")).toHaveCount(25);
  await expect(page.locator("#dots-board .dots-edge.is-playable")).toHaveCount(60);
  await expect(page.locator("#turn-indicator .turn-score-match")).toHaveCount(0);
  await expect(page.locator("#turn-indicator .turn-score-game")).toHaveCount(2);
  const mirrorLayout = await page.evaluate(() => {
    const guestPane = document.querySelector('#turn-indicator [data-side="guest"]');
    const guestMeta = document.querySelector('#turn-indicator [data-side="guest"] .turn-meta');
    if (!(guestPane instanceof HTMLElement)) return null;
    return {
      guestFlexDirection: getComputedStyle(guestPane).flexDirection,
      guestMetaExists: guestMeta instanceof HTMLElement
    };
  });
  expect(mirrorLayout).not.toBeNull();
  expect(mirrorLayout?.guestFlexDirection).toBe("row-reverse");
  expect(mirrorLayout?.guestMetaExists).toBe(true);

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
  await expect(page.locator('#turn-indicator [data-side="host"] .turn-score-game')).toHaveText("1");

  const prePlayedEdges = new Set([0, 10, 30, 11, 5, 12, 31]);
  for (let edgeIndex = 0; edgeIndex < 60; edgeIndex += 1) {
    if (prePlayedEdges.has(edgeIndex)) continue;
    await clickEdge(edgeIndex);
  }

  await expect(page.locator("#new-round")).toBeVisible({ timeout: 9000 });
  await expect(page.locator("#turn-indicator .turn-player-cta")).toHaveCount(0);
  await expect(page.locator("#turn-indicator .turn-score-match")).toHaveCount(0);
});

test("local poker dice banks points immediately and swaps to pass-only CTA at end of turn", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__multipassLegacyReady === true);

  await page.getByRole("button", { name: "Local" }).click();
  await expect(page.locator("#screen-local.active")).toBeVisible();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="yellow"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="green"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#screen-lobby.active")).toBeVisible();
  await page.getByRole("button", { name: "Play Poker Dice" }).click();
  await expect(page.locator("#screen-game.active")).toBeVisible();
  await expect(page.locator("#poker-dice-layout")).not.toHaveClass(/hidden/);
  await expect(page.locator("#poker-dice-dice .poker-die")).toHaveCount(6);
  await expect(page.locator("#poker-dice-layout .poker-dice-score-guide")).toBeVisible();
  await expect(page.locator("#poker-dice-layout .poker-dice-score-row")).toHaveCount(9);
  await expect(page.locator('#poker-dice-layout [data-poker-category="one_pair"]')).toContainText("0 pts");
  await expect(page.locator('#poker-dice-layout [data-poker-category="high_card"]')).toContainText("0 pts");
  await expect(page.locator("#poker-dice-info")).toHaveCount(0);
  await expect(page.locator("#poker-dice-info-modal")).toHaveCount(0);

  await expect(page.locator("#poker-dice-pass-play")).toHaveClass(/hidden/);
  await expect(page.locator("#poker-dice-roll")).not.toHaveClass(/hidden/);
  await expect(page.locator("#poker-dice-bank")).toHaveClass(/hidden/);
  await expect(page.locator("#poker-dice-clear-hold")).toHaveClass(/hidden/);

  await page.locator("#poker-dice-roll").click();
  await expect(page.locator("#poker-dice-bank")).toBeEnabled({ timeout: 6000 });
  await expect(page.locator("#poker-dice-layout .poker-dice-score-row.is-projected")).toHaveCount(1);
  const projectedCategoryAfterRoll = await page
    .locator("#poker-dice-layout .poker-dice-score-row.is-projected")
    .first()
    .getAttribute("data-poker-category");
  expect(projectedCategoryAfterRoll).toBeTruthy();
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

  await page.getByRole("button", { name: "Local" }).click();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="yellow"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="blue"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#screen-lobby.active")).toBeVisible();

  await expect(page.locator("#score-columns .score-duel-side")).toHaveCount(2);
  await expect(page.locator("#app-fixed-footer")).toHaveClass(/hidden/);
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

  const scoreAvatarShapes = await page.locator("#score-columns .score-duel-top .player-card-shell--score").evaluateAll((nodes) => {
    return nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        ratio: rect.height ? rect.width / rect.height : 0
      };
    });
  });
  expect(scoreAvatarShapes.length).toBe(2);
  for (const shape of scoreAvatarShapes) {
    expect(shape.width).toBeGreaterThan(0);
    expect(shape.height).toBeGreaterThan(0);
    expect(Math.abs(shape.ratio - 1)).toBeLessThan(0.03);
  }

  await expect(page.locator("#screen-lobby #game-list .game-card")).toHaveCount(4);
});

test("local pick can launch word fight module", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__multipassLegacyReady === true);

  await page.getByRole("button", { name: "Local" }).click();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="yellow"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="green"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#screen-lobby.active")).toBeVisible();
  await page.getByRole("button", { name: "Play Word Fight", exact: true }).click();

  await expect(page.locator("#screen-game.active")).toBeVisible();
  await expect(page.locator("#word-fight-layout")).not.toHaveClass(/hidden/);
  await expect(page.locator("#word-fight-secret")).toHaveCount(0);
  await expect(page.locator("#word-fight-draft-row")).toHaveCount(0);
  await expect(page.locator("#word-fight-keyboard")).toBeVisible();
  await expect(page.locator('#word-fight-keyboard [data-word-fight-key="T"]')).toBeVisible();
  await expect(page.locator("#word-fight-status")).toBeHidden();
  await expect(page.locator("#word-fight-active-board .word-fight-row")).toHaveCount(5);
  const hintTitle = page.locator("#word-fight-active-title");
  await expect(hintTitle).toContainText("Hint:");
  await expect(hintTitle).not.toContainText("Board");
  const expectedOpeningHint = await page.evaluate(() => {
    const room = window.__multipassStore.getState().room;
    const gameState = room?.game?.state;
    const activePlayerId = gameState?.nextPlayerId;
    return activePlayerId ? gameState?.categoryByPlayer?.[activePlayerId] || null : null;
  });
  expect(expectedOpeningHint).toBeTruthy();
  await expect(hintTitle).toHaveText(`Hint: ${expectedOpeningHint}`);
  await expect(page.locator("#word-fight-you-board")).toHaveCount(0);
  await expect(page.locator("#word-fight-opponent-board")).toHaveCount(0);
  await expect(page.locator('#turn-indicator [data-side="host"]')).toHaveAttribute("data-active", "true");
  await expect(page.locator('#turn-indicator [data-side="guest"]')).toHaveAttribute("data-active", "false");
  await expect(page.locator('#turn-indicator [data-side="host"] .turn-score-game')).toHaveText("0");
  await expect(page.locator('#turn-indicator [data-side="guest"] .turn-score-game')).toHaveText("0");

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
  await expect(page.locator("#word-fight-keyboard")).toHaveClass(/hidden/);
  await expect(page.locator('#word-fight-keyboard [data-word-fight-key="T"]')).toBeDisabled();
  await expect(page.locator("#word-fight-actions")).not.toHaveClass(/hidden/);
  await expect(page.locator("#word-fight-pass-turn")).toBeVisible();
  await expect(page.locator("#word-fight-status")).toBeHidden();
  await expect(page.locator('#turn-indicator [data-side="host"]')).toHaveAttribute("data-active", "true");
  await expect(page.locator('#turn-indicator [data-side="guest"]')).toHaveAttribute("data-active", "false");
  const hostScoreAfterGuess = await page.locator('#turn-indicator [data-side="host"] .turn-score-game').innerText();
  expect(Number.parseInt(hostScoreAfterGuess, 10)).toBeGreaterThanOrEqual(0);
  await expect(page.locator('#turn-indicator [data-side="guest"] .turn-score-game')).toHaveText("0");

  await page.locator("#word-fight-pass-turn").click();
  await expect(page.locator("#word-fight-keyboard")).not.toHaveClass(/hidden/);
  await expect(page.locator("#word-fight-actions")).toHaveClass(/hidden/);
  const expectedAfterPassHint = await page.evaluate(() => {
    const room = window.__multipassStore.getState().room;
    const gameState = room?.game?.state;
    const activePlayerId = gameState?.nextPlayerId;
    return activePlayerId ? gameState?.categoryByPlayer?.[activePlayerId] || null : null;
  });
  expect(expectedAfterPassHint).toBeTruthy();
  await expect(hintTitle).toHaveText(`Hint: ${expectedAfterPassHint}`);
  await expect(page.locator('#turn-indicator [data-side="host"]')).toHaveAttribute("data-active", "false");
  await expect(page.locator('#turn-indicator [data-side="guest"]')).toHaveAttribute("data-active", "true");
  const [hostScoreAfterPass, guestScoreAfterPass] = await Promise.all([
    page.locator('#turn-indicator [data-side="host"] .turn-score-game').innerText(),
    page.locator('#turn-indicator [data-side="guest"] .turn-score-game').innerText()
  ]);
  expect(Number.parseInt(hostScoreAfterPass, 10)).toBeGreaterThanOrEqual(0);
  expect(Number.parseInt(guestScoreAfterPass, 10)).toBeGreaterThanOrEqual(0);
});

test("word fight reveals exhausted secret only for the exhausted local viewer", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__multipassLegacyReady === true);

  await page.getByRole("button", { name: "Local" }).click();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="yellow"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('#local-avatar-grid .avatar-option[data-avatar="green"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#screen-lobby.active")).toBeVisible();
  await page.getByRole("button", { name: "Play Word Fight", exact: true }).click();
  await expect(page.locator("#screen-game.active")).toBeVisible();

  const snapshot = await page.evaluate(() => {
    const appState = window.__multipassStore.getState();
    const room = appState.room;
    const hostId = room?.players?.host?.id || null;
    const guestId = room?.players?.guest?.id || null;
    const wordsByPlayer = room?.game?.state?.wordsByPlayer || {};
    return {
      hostId,
      guestId,
      hostSecret: String(wordsByPlayer[hostId] || "").toUpperCase(),
      guestSecret: String(wordsByPlayer[guestId] || "").toUpperCase()
    };
  });

  expect(snapshot.hostSecret).toMatch(/^[A-Z]{4}$/);
  expect(snapshot.guestSecret).toMatch(/^[A-Z]{4}$/);

  const hostWrongGuesses = WORD_FIGHT_GUESS_CANDIDATES
    .filter((word) => word !== snapshot.hostSecret)
    .slice(0, 5);
  const guestWrongGuesses = WORD_FIGHT_GUESS_CANDIDATES
    .filter((word) => word !== snapshot.guestSecret)
    .slice(0, 4);
  expect(hostWrongGuesses).toHaveLength(5);
  expect(guestWrongGuesses).toHaveLength(4);

  const status = page.locator("#word-fight-status");

  for (let turn = 0; turn < 4; turn += 1) {
    await expect(page.locator("#word-fight-keyboard")).toBeVisible();
    await enterWordFightGuess(page, hostWrongGuesses[turn]);
    await expect(page.locator("#word-fight-pass-turn")).toBeVisible();
    await expect(status).toBeHidden();
    await page.locator("#word-fight-pass-turn").click();

    await expect(page.locator("#word-fight-keyboard")).toBeVisible();
    await enterWordFightGuess(page, guestWrongGuesses[turn]);
    await expect(page.locator("#word-fight-pass-turn")).toBeVisible();
    await expect(status).toBeHidden();
    await page.locator("#word-fight-pass-turn").click();
  }

  await expect(page.locator("#word-fight-keyboard")).toBeVisible();
  await enterWordFightGuess(page, hostWrongGuesses[4]);
  await expect(page.locator("#word-fight-pass-turn")).toBeVisible();
  await expect(status).toBeVisible();
  await expect(status).toHaveText(`Out of guesses. Your word was ${snapshot.hostSecret}.`);

  await page.locator("#word-fight-pass-turn").click();
  await expect(page.locator("#word-fight-keyboard")).toBeVisible();
  await expect(status).toBeHidden();
  await expect(status).toHaveText("");
});
