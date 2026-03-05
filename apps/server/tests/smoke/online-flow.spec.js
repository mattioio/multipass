import { expect, test } from "@playwright/test";

async function gotoApp(page, hash = "") {
  await page.goto(`http://127.0.0.1:3000/${hash}`);
  await page.waitForFunction(() => window.__multipassLegacyReady === true);
}

async function fillJoinCodeSlots(page, rawCode) {
  const code = String(rawCode || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .replace(/[IO]/g, "")
    .slice(0, 4);
  for (let index = 0; index < 4; index += 1) {
    await page.locator(`#join-code-slot-${index}`).fill(code[index] || "");
  }
}

function gameCard(page, gameName) {
  return page
    .locator("#screen-lobby #game-list .game-card")
    .filter({ has: page.locator(".game-name", { hasText: gameName }) })
    .first();
}

function gameCta(page, gameName) {
  return gameCard(page, gameName).locator(".game-cta");
}

async function readHomeChromeState(page) {
  return page.evaluate(() => {
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
}

test("online happy path: host + guest choose game -> game", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  await gotoApp(hostPage);
  const landingChrome = await readHomeChromeState(hostPage);
  await hostPage.getByRole("button", { name: "Online" }).click();
  const onlineChrome = await readHomeChromeState(hostPage);
  expect(onlineChrome.settingsVisible).toBe(landingChrome.settingsVisible);
  expect(onlineChrome.logoWidth).toBe(landingChrome.logoWidth);
  expect(Math.abs((onlineChrome.settingsX ?? 0) - (landingChrome.settingsX ?? 0))).toBeLessThanOrEqual(1);
  if (onlineChrome.leftActionVisible) {
    expect(onlineChrome.leftActionLabel).not.toMatch(/close|back/i);
  }
  await hostPage.locator("#screen-online .sheet-backdrop").click();
  await expect(hostPage.locator("#screen-online.is-closing")).toBeVisible();
  await expect(hostPage.locator("#screen-online.active")).toHaveCount(0);
  await expect(hostPage.locator("#screen-landing.active")).toBeVisible();
  await hostPage.getByRole("button", { name: "Online" }).click();
  await expect(hostPage.locator("#screen-online.active")).toBeVisible();
  await hostPage.getByRole("button", { name: "Host a room" }).click();
  const hostChrome = await readHomeChromeState(hostPage);
  expect(hostChrome.settingsVisible).toBe(landingChrome.settingsVisible);
  expect(hostChrome.logoWidth).toBe(landingChrome.logoWidth);
  expect(Math.abs((hostChrome.settingsX ?? 0) - (landingChrome.settingsX ?? 0))).toBeLessThanOrEqual(1);
  if (hostChrome.leftActionVisible) {
    expect(hostChrome.leftActionLabel).not.toMatch(/close|back/i);
  }
  await expect(hostPage.getByRole("button", { name: "Pick a player" })).toBeDisabled();
  await hostPage.locator('#host-avatar-picker .avatar-option[data-avatar="yellow"]').click();
  await expect(hostPage.getByRole("button", { name: "Continue" })).toBeEnabled();
  await hostPage.getByRole("button", { name: "Continue" }).click();

  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(hostPage.locator("#room-code")).toContainText(/[A-Z]{4}/);
  const roomCode = (await hostPage.locator("#room-code").textContent())?.trim() || "";

  await gotoApp(guestPage);
  await guestPage.getByRole("button", { name: "Online" }).click();
  await guestPage.getByRole("button", { name: "Join a room" }).click();
  await fillJoinCodeSlots(guestPage, roomCode);
  await expect(guestPage.locator("#join-avatar-picker:not(.hidden)")).toBeVisible();
  await expect(guestPage.getByRole("button", { name: "Join room" })).toBeVisible();
  await guestPage.locator('#join-avatar-picker .avatar-option[data-avatar="green"]').click();
  await guestPage.getByRole("button", { name: "Join room" }).click();

  await expect(guestPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  const lobbyChrome = await readHomeChromeState(hostPage);
  expect(lobbyChrome.leftActionVisible).toBe(true);
  expect(lobbyChrome.settingsVisible).toBe(true);
  expect(lobbyChrome.centerTitleVisible).toBe(false);
  expect(lobbyChrome.centerLogoVisible).toBe(false);
  expect(lobbyChrome.centerHasAction).toBe(false);
  expect((lobbyChrome.leftActionX ?? 0) < ((lobbyChrome.viewportWidth ?? 0) / 3)).toBe(true);
  expect((lobbyChrome.settingsX ?? 0) > (((lobbyChrome.viewportWidth ?? 0) * 2) / 3)).toBe(true);
  await expect(hostPage.locator("#score-columns .score-duel-panel")).toHaveCount(1);
  await expect(hostPage.locator("#score-columns .score-duel-side")).toHaveCount(2);
  await expect(hostPage.locator("#score-columns .score-duel-meta")).toHaveCount(2);
  await expect(hostPage.locator("#score-columns .score-duel-name")).toHaveCount(2);
  await expect(hostPage.locator("#score-columns .score-duel-points")).toHaveCount(2);
  await expect(hostPage.locator("#score-columns .score-duel-scorebar-wrap")).toHaveCount(0);
  await expect(hostPage.locator("#score-columns .score-broadcast-row")).toHaveCount(0);
  await expect(hostPage.locator("#score-columns .score-role")).toHaveCount(0);
  await expect(hostPage.locator("#score-columns .score-column")).toHaveCount(0);
  const hostLobbyHostScoreRotationVar = await hostPage
    .locator("#score-columns .score-duel-side:not(.score-duel-side-guest) .player-card-shell--score")
    .evaluate((node) => getComputedStyle(node).getPropertyValue("--avatar-pattern-rotation").trim());
  const hostLobbyGuestScoreRotationVar = await hostPage
    .locator("#score-columns .score-duel-side-guest .player-card-shell--score")
    .evaluate((node) => getComputedStyle(node).getPropertyValue("--avatar-pattern-rotation").trim());
  const guestLobbyHostScoreRotationVar = await guestPage
    .locator("#score-columns .score-duel-side:not(.score-duel-side-guest) .player-card-shell--score")
    .evaluate((node) => getComputedStyle(node).getPropertyValue("--avatar-pattern-rotation").trim());
  const guestLobbyGuestScoreRotationVar = await guestPage
    .locator("#score-columns .score-duel-side-guest .player-card-shell--score")
    .evaluate((node) => getComputedStyle(node).getPropertyValue("--avatar-pattern-rotation").trim());
  expect(hostLobbyHostScoreRotationVar).toBe("0deg");
  expect(hostLobbyGuestScoreRotationVar).toBe("180deg");
  expect(guestLobbyHostScoreRotationVar).toBe("0deg");
  expect(guestLobbyGuestScoreRotationVar).toBe("180deg");

  await expect(hostPage.locator("#screen-lobby #game-list .game-card")).toHaveCount(4);
  await expect(guestPage.locator("#screen-lobby #game-list .game-card")).toHaveCount(4);
  await hostPage.evaluate(() => {
    window.location.hash = "#pick";
  });
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  await expect.poll(() => new URL(hostPage.url()).hash).toBe("#lobby");

  const hostTicTacToeCta = gameCta(hostPage, "Tic Tac Toe");
  const guestTicTacToeCta = gameCta(guestPage, "Tic Tac Toe");

  await expect(hostTicTacToeCta).toHaveText("Play");
  await expect(guestTicTacToeCta).toHaveText("Play");

  await hostTicTacToeCta.click();
  await expect(hostTicTacToeCta).toHaveText("Selected");
  await expect(guestTicTacToeCta).toHaveText("Agree");
  await expect(gameCard(guestPage, "Tic Tac Toe").locator(".agree-chip")).toHaveText("Teammate picked this");

  await guestTicTacToeCta.click();
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(guestPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(hostTicTacToeCta).toHaveText(/Starting in [1-3]/, { timeout: 1500 });
  await expect(guestTicTacToeCta).toHaveText(/Starting in [1-3]/, { timeout: 1500 });
  await expect(hostPage.locator("#pick-status")).toContainText(/Starting in [1-3]/);
  await expect(guestPage.locator("#pick-status")).toContainText(/Starting in [1-3]/);

  await expect(hostPage.locator("#screen-game.active")).toBeVisible();
  await expect(guestPage.locator("#screen-game.active")).toBeVisible();
  await expect(hostPage.locator("#screen-game .game-surface-head")).toHaveCount(0);
  await expect(hostPage.locator("#screen-game .game-surface-title")).toHaveCount(0);
  await expect(hostPage.locator("#screen-game .game-surface-status")).toHaveCount(0);
  await expect(guestPage.locator("#screen-game .game-surface-head")).toHaveCount(0);
  await expect(guestPage.locator("#screen-game .game-surface-title")).toHaveCount(0);
  await expect(guestPage.locator("#screen-game .game-surface-status")).toHaveCount(0);
  await expect(hostPage.locator("#turn-indicator .turn-pane")).toHaveCount(2);
  await expect(guestPage.locator("#turn-indicator .turn-pane")).toHaveCount(2);
  await expect(hostPage.locator("#turn-indicator .turn-meta")).toHaveCount(2);
  await expect(guestPage.locator("#turn-indicator .turn-meta")).toHaveCount(2);
  await expect(hostPage.locator("#turn-indicator .turn-score-match")).toHaveCount(0);
  await expect(hostPage.locator("#turn-indicator .turn-score-game")).toHaveCount(0);
  await expect(guestPage.locator("#turn-indicator .turn-score-match")).toHaveCount(0);
  await expect(guestPage.locator("#turn-indicator .turn-score-game")).toHaveCount(0);
  const firstRoundStarter = await hostPage.evaluate(() => {
    const room = window.__multipassStore.getState().room;
    return {
      firstPlayerId: room.round?.firstPlayerId || null,
      hostId: room.players?.host?.id || null
    };
  });
  expect(firstRoundStarter.firstPlayerId).toBe(firstRoundStarter.hostId);

  await expect(hostPage.locator("#ttt-board .ttt-cell")).toHaveCount(9);
  await expect(guestPage.locator("#ttt-board .ttt-cell")).toHaveCount(9);

  await hostContext.close();
  await guestContext.close();
});

test("online agreement countdown cancels when a player changes game before start", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  await gotoApp(hostPage);
  await hostPage.getByRole("button", { name: "Online" }).click();
  await hostPage.getByRole("button", { name: "Host a room" }).click();
  await hostPage.locator('#host-avatar-picker .avatar-option[data-avatar="yellow"]').click();
  await hostPage.getByRole("button", { name: "Continue" }).click();
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  const roomCode = (await hostPage.locator("#room-code").textContent())?.trim() || "";

  await gotoApp(guestPage);
  await guestPage.getByRole("button", { name: "Online" }).click();
  await guestPage.getByRole("button", { name: "Join a room" }).click();
  await fillJoinCodeSlots(guestPage, roomCode);
  await expect(guestPage.locator("#join-avatar-picker:not(.hidden)")).toBeVisible();
  await guestPage.locator('#join-avatar-picker .avatar-option[data-avatar="green"]').click();
  await guestPage.getByRole("button", { name: "Join room" }).click();

  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(guestPage.locator("#screen-lobby.active")).toBeVisible();

  const hostTicTacToeCta = gameCta(hostPage, "Tic Tac Toe");
  const guestTicTacToeCta = gameCta(guestPage, "Tic Tac Toe");
  const hostDotsCta = gameCta(hostPage, "Dots & Boxes");
  const guestDotsCta = gameCta(guestPage, "Dots & Boxes");

  await hostTicTacToeCta.click();
  await expect(hostTicTacToeCta).toHaveText("Selected");
  await expect(guestTicTacToeCta).toHaveText("Agree");

  await guestTicTacToeCta.click();
  await expect(hostTicTacToeCta).toHaveText(/Starting in [1-3]/, { timeout: 1500 });
  await expect(guestTicTacToeCta).toHaveText(/Starting in [1-3]/, { timeout: 1500 });

  await hostDotsCta.click();
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(guestPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(hostTicTacToeCta).toHaveText("Agree");
  await expect(guestTicTacToeCta).toHaveText("Selected");
  await expect(guestDotsCta).toHaveText("Agree");

  await hostPage.waitForTimeout(3400);
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(guestPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(hostPage.locator("#screen-game.active")).toHaveCount(0);
  await expect(guestPage.locator("#screen-game.active")).toHaveCount(0);

  await guestDotsCta.click();
  await expect(hostDotsCta).toHaveText(/Starting in [1-3]/, { timeout: 1500 });
  await expect(guestDotsCta).toHaveText(/Starting in [1-3]/, { timeout: 1500 });
  await expect(hostPage.locator("#screen-game.active")).toBeVisible();
  await expect(guestPage.locator("#screen-game.active")).toBeVisible();
  await expect(hostPage.locator("#dots-layout")).not.toHaveClass(/hidden/);
  await expect(guestPage.locator("#dots-layout")).not.toHaveClass(/hidden/);

  await hostContext.close();
  await guestContext.close();
});

test("online dots and boxes syncs edge moves across host and guest", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  await gotoApp(hostPage);
  await hostPage.getByRole("button", { name: "Online" }).click();
  await hostPage.getByRole("button", { name: "Host a room" }).click();
  await hostPage.locator('#host-avatar-picker .avatar-option[data-avatar="yellow"]').click();
  await hostPage.getByRole("button", { name: "Continue" }).click();
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  const roomCode = (await hostPage.locator("#room-code").textContent())?.trim() || "";

  await gotoApp(guestPage);
  await guestPage.getByRole("button", { name: "Online" }).click();
  await guestPage.getByRole("button", { name: "Join a room" }).click();
  await fillJoinCodeSlots(guestPage, roomCode);
  await expect(guestPage.locator("#join-avatar-picker:not(.hidden)")).toBeVisible();
  await guestPage.locator('#join-avatar-picker .avatar-option[data-avatar="green"]').click();
  await guestPage.getByRole("button", { name: "Join room" }).click();

  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(guestPage.locator("#screen-lobby.active")).toBeVisible();

  await gameCta(hostPage, "Dots & Boxes").click();
  await gameCta(guestPage, "Dots & Boxes").click();

  await expect(hostPage.locator("#screen-game.active")).toBeVisible();
  await expect(guestPage.locator("#screen-game.active")).toBeVisible();
  await expect(hostPage.locator("#dots-layout")).not.toHaveClass(/hidden/);
  await expect(guestPage.locator("#dots-layout")).not.toHaveClass(/hidden/);
  await expect(hostPage.locator("#dots-board .dots-edge")).toHaveCount(60);
  await expect(guestPage.locator("#dots-board .dots-edge")).toHaveCount(60);
  await expect(hostPage.locator("#turn-indicator .turn-score-match")).toHaveCount(0);
  await expect(hostPage.locator("#turn-indicator .turn-score-game")).toHaveCount(2);
  await expect(guestPage.locator("#turn-indicator .turn-score-match")).toHaveCount(0);
  await expect(guestPage.locator("#turn-indicator .turn-score-game")).toHaveCount(2);

  const starter = await hostPage.evaluate(() => window.__multipassStore.getState().room.game.state.nextPlayerId);
  const hostPlayerId = await hostPage.evaluate(() => window.__multipassStore.getState().room.players.host.id);
  expect(starter).toBe(hostPlayerId);
  await expect(hostPage.locator("#turn-indicator")).toHaveAttribute("data-mode", "turn");
  await expect(hostPage.locator("#turn-indicator")).toHaveAttribute("data-active-side", "host");
  await expect(hostPage.locator('#turn-indicator [data-side="host"]')).toHaveAttribute("data-active", "true");
  await expect(hostPage.locator('#turn-indicator [data-side="guest"]')).toHaveAttribute("data-active", "false");
  await expect(hostPage.locator('#turn-indicator [data-side="host"] .turn-score-game')).toHaveText("0");
  await expect(hostPage.locator('#turn-indicator [data-side="guest"] .turn-score-game')).toHaveText("0");
  const mirroredHostLayout = await hostPage.evaluate(() => {
    const guestPane = document.querySelector('#turn-indicator [data-side="guest"]');
    const guestMeta = document.querySelector('#turn-indicator [data-side="guest"] .turn-meta');
    if (!(guestPane instanceof HTMLElement)) return null;
    return {
      guestFlexDirection: getComputedStyle(guestPane).flexDirection,
      guestMetaExists: guestMeta instanceof HTMLElement
    };
  });
  expect(mirroredHostLayout).not.toBeNull();
  expect(mirroredHostLayout?.guestFlexDirection).toBe("row-reverse");
  expect(mirroredHostLayout?.guestMetaExists).toBe(true);
  const mirroredGuestLayout = await guestPage.evaluate(() => {
    const guestPane = document.querySelector('#turn-indicator [data-side="guest"]');
    const guestMeta = document.querySelector('#turn-indicator [data-side="guest"] .turn-meta');
    if (!(guestPane instanceof HTMLElement)) return null;
    return {
      guestFlexDirection: getComputedStyle(guestPane).flexDirection,
      guestMetaExists: guestMeta instanceof HTMLElement
    };
  });
  expect(mirroredGuestLayout).not.toBeNull();
  expect(mirroredGuestLayout?.guestFlexDirection).toBe("row-reverse");
  expect(mirroredGuestLayout?.guestMetaExists).toBe(true);
  await expect(hostPage.locator("#dots-board .dots-edge.is-playable")).toHaveCount(60);
  await expect(guestPage.locator("#dots-board .dots-edge.is-playable")).toHaveCount(0);

  const expectHistoryLength = async (length) => {
    await expect.poll(async () => {
      return hostPage.evaluate(() => window.__multipassStore.getState().room.game.state.history.length);
    }).toBe(length);
    await expect.poll(async () => {
      return guestPage.evaluate(() => window.__multipassStore.getState().room.game.state.history.length);
    }).toBe(length);
  };

  const clickEdge = async (playerPage, edgeIndex, historyLength) => {
    await playerPage.locator(`#dots-board .dots-edge[data-edge-index="${edgeIndex}"]`).click();
    await expectHistoryLength(historyLength);
  };

  await clickEdge(hostPage, 0, 1);
  await expect(hostPage.locator("#dots-board .dots-edge.is-last-move")).toHaveCount(1);
  await expect(guestPage.locator("#dots-board .dots-edge.is-last-move")).toHaveCount(1);
  await expect(hostPage.locator("#dots-board .dots-edge.is-playable")).toHaveCount(0);
  await expect(guestPage.locator("#dots-board .dots-edge.is-playable")).toHaveCount(59);
  await expect(hostPage.locator("#turn-indicator")).toHaveAttribute("data-active-side", "guest");
  await expect(hostPage.locator('#turn-indicator [data-side="host"]')).toHaveAttribute("data-active", "false");
  await expect(hostPage.locator('#turn-indicator [data-side="guest"]')).toHaveAttribute("data-active", "true");

  await clickEdge(guestPage, 10, 2);
  await clickEdge(hostPage, 30, 3);
  await clickEdge(guestPage, 11, 4);
  await clickEdge(hostPage, 5, 5);
  await clickEdge(guestPage, 12, 6);
  await expect(hostPage.locator('#dots-board .dots-edge[data-edge-index="31"]')).toHaveClass(/is-scoring-opportunity/);
  await expect(hostPage.locator("#turn-indicator")).toHaveAttribute("data-active-side", "host");
  await expect(hostPage.locator('#turn-indicator [data-side="host"]')).toHaveAttribute("data-active", "true");
  await expect(hostPage.locator('#turn-indicator [data-side="guest"]')).toHaveAttribute("data-active", "false");

  await clickEdge(hostPage, 31, 7);
  await expect(hostPage.locator("#dots-board .dots-edge.is-last-move")).toHaveCount(1);
  await expect(guestPage.locator("#dots-board .dots-edge.is-last-move")).toHaveCount(1);
  await expect(hostPage.locator('#turn-indicator [data-side="host"] .turn-score-game')).toHaveText("1");
  await expect(guestPage.locator('#turn-indicator [data-side="host"] .turn-score-game')).toHaveText("1");
  await expect(hostPage.locator("#turn-indicator")).toHaveAttribute("data-active-side", "host");
  await expect(hostPage.locator('#turn-indicator [data-side="host"]')).toHaveAttribute("data-active", "true");
  await expect(hostPage.locator('#turn-indicator [data-side="guest"]')).toHaveAttribute("data-active", "false");

  const syncedGuestState = await guestPage.evaluate(() => {
    const room = window.__multipassStore.getState().room;
    return {
      edgeOwner: room.game.state.edges[31],
      boxOwner: room.game.state.boxes[0],
      hostId: room.players.host.id,
      nextPlayerId: room.game.state.nextPlayerId
    };
  });
  expect(syncedGuestState.edgeOwner).toBe(syncedGuestState.hostId);
  expect(syncedGuestState.boxOwner).toBe(syncedGuestState.hostId);
  expect(syncedGuestState.nextPlayerId).toBe(syncedGuestState.hostId);

  await hostContext.close();
  await guestContext.close();
});

test("online deep-link join: guest opens #join=CODE invite", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  await gotoApp(hostPage);
  await hostPage.getByRole("button", { name: "Online" }).click();
  await hostPage.getByRole("button", { name: "Host a room" }).click();
  await expect(hostPage.getByRole("button", { name: "Pick a player" })).toBeDisabled();
  await hostPage.locator('#host-avatar-picker .avatar-option[data-avatar="yellow"]').click();
  await expect(hostPage.getByRole("button", { name: "Continue" })).toBeEnabled();
  await hostPage.getByRole("button", { name: "Continue" }).click();
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();

  const roomCode = (await hostPage.locator("#room-code").textContent())?.trim() || "";
  await gotoApp(guestPage, `#join=${roomCode}`);

  await expect(guestPage.locator("#screen-join.active")).toBeVisible();
  await expect(guestPage.locator("#join-code")).toHaveValue(roomCode);
  await expect(guestPage.locator("#join-code-slot-0")).toHaveValue(roomCode[0] || "");
  await expect(guestPage.locator("#join-code-slot-1")).toHaveValue(roomCode[1] || "");
  await expect(guestPage.locator("#join-code-slot-2")).toHaveValue(roomCode[2] || "");
  await expect(guestPage.locator("#join-code-slot-3")).toHaveValue(roomCode[3] || "");
  await expect(guestPage.getByRole("button", { name: "Join room" })).toBeVisible();

  await guestPage.locator('#join-avatar-picker .avatar-option[data-avatar="green"]').click();
  await guestPage.getByRole("button", { name: "Join room" }).click();

  await expect(guestPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();

  await hostContext.close();
  await guestContext.close();
});

test("online lobby Home leaves on first click and stays on landing", async ({ page }) => {
  await gotoApp(page);
  await page.getByRole("button", { name: "Online" }).click();
  await page.getByRole("button", { name: "Host a room" }).click();
  await page.locator('#host-avatar-picker .avatar-option[data-avatar="yellow"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#screen-lobby.active")).toBeVisible();

  await page.getByRole("button", { name: "Home" }).click();
  await expect(page.locator("#screen-landing.active")).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.locator("#screen-landing.active")).toBeVisible();
  await expect.poll(() => new URL(page.url()).hash).toMatch(/^(|#landing)$/);
});

test("online game Back closes board sheet and returns to lobby", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  await gotoApp(hostPage);
  await hostPage.getByRole("button", { name: "Online" }).click();
  await hostPage.getByRole("button", { name: "Host a room" }).click();
  await hostPage.locator('#host-avatar-picker .avatar-option[data-avatar="yellow"]').click();
  await hostPage.getByRole("button", { name: "Continue" }).click();
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  const roomCode = (await hostPage.locator("#room-code").textContent())?.trim() || "";

  await gotoApp(guestPage);
  await guestPage.getByRole("button", { name: "Online" }).click();
  await guestPage.getByRole("button", { name: "Join a room" }).click();
  await fillJoinCodeSlots(guestPage, roomCode);
  await expect(guestPage.locator("#join-avatar-picker:not(.hidden)")).toBeVisible();
  await guestPage.locator('#join-avatar-picker .avatar-option[data-avatar="green"]').click();
  await guestPage.getByRole("button", { name: "Join room" }).click();
  await expect(guestPage.locator("#screen-lobby.active")).toBeVisible();

  await gameCta(hostPage, "Tic Tac Toe").click();
  await gameCta(guestPage, "Tic Tac Toe").click();
  await expect(hostPage.locator("#screen-game.active")).toBeVisible();
  await expect(hostPage.locator("#open-settings")).toBeHidden();
  await expect(hostPage.locator("#screen-game #game-close-board")).toBeVisible();

  await hostPage.locator("#screen-game #game-close-board").click();
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(hostPage.locator("#screen-game.active")).toHaveCount(0);
  await hostPage.waitForTimeout(800);
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  await expect.poll(() => new URL(hostPage.url()).hash).toBe("#lobby");

  await hostContext.close();
  await guestContext.close();
});

test("online honorific picker is independent per player", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  await gotoApp(hostPage);
  await hostPage.getByRole("button", { name: "Online" }).click();
  await hostPage.getByRole("button", { name: "Host a room" }).click();
  await hostPage.locator("#host-honorific-toolbar .switch").click();
  await hostPage.locator('#host-avatar-picker .avatar-option[data-avatar="yellow"]').click();
  await hostPage.getByRole("button", { name: "Continue" }).click();
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(hostPage.locator("#score-columns")).toContainText("Mrs Yellow");
  const roomCode = (await hostPage.locator("#room-code").textContent())?.trim() || "";

  await gotoApp(guestPage);
  await guestPage.getByRole("button", { name: "Online" }).click();
  await guestPage.getByRole("button", { name: "Join a room" }).click();
  await fillJoinCodeSlots(guestPage, roomCode);
  await expect(guestPage.locator("#join-avatar-picker:not(.hidden)")).toBeVisible();
  const lockedYellowTile = guestPage.locator('#join-avatar-picker .avatar-option.p1-locked[data-avatar="yellow"]');
  const redTileArt = guestPage.locator('#join-avatar-picker .avatar-option[data-avatar="red"] .player-art img');
  await expect(lockedYellowTile).toBeVisible();
  await expect(lockedYellowTile.locator(".avatar-name")).toHaveText("Mrs Yellow");
  await expect(guestPage.locator("#join-honorific-toggle")).not.toBeChecked();
  await expect(guestPage.locator('#join-avatar-picker .avatar-option[data-avatar="red"] .avatar-name')).toHaveText("Mr Red");
  const lockedSrc = await lockedYellowTile.locator(".player-art img").getAttribute("src");
  const redMrSrc = await redTileArt.getAttribute("src");
  expect(lockedSrc).toBeTruthy();
  expect(redMrSrc).toBeTruthy();
  expect(lockedSrc).not.toBe(redMrSrc);

  await guestPage.locator("#join-honorific-toolbar .switch").click();
  await expect(guestPage.locator("#join-honorific-toggle")).toBeChecked();
  await expect(guestPage.locator('#join-avatar-picker .avatar-option[data-avatar="red"] .avatar-name')).toHaveText("Mrs Red");
  await expect(lockedYellowTile.locator(".avatar-name")).toHaveText("Mrs Yellow");
  const redMrsSrc = await redTileArt.getAttribute("src");
  const lockedSrcWhileGuestMrs = await lockedYellowTile.locator(".player-art img").getAttribute("src");
  expect(redMrsSrc).toBeTruthy();
  expect(lockedSrcWhileGuestMrs).toBe(lockedSrc);
  expect(redMrsSrc).toBe(lockedSrc);

  await guestPage.locator("#join-honorific-toolbar .switch").click();
  await expect(guestPage.locator("#join-honorific-toggle")).not.toBeChecked();
  await expect(guestPage.locator('#join-avatar-picker .avatar-option[data-avatar="red"] .avatar-name')).toHaveText("Mr Red");
  await expect(lockedYellowTile.locator(".avatar-name")).toHaveText("Mrs Yellow");
  const redMrSrcAgain = await redTileArt.getAttribute("src");
  const lockedSrcAfterToggleBack = await lockedYellowTile.locator(".player-art img").getAttribute("src");
  expect(redMrSrcAgain).toBe(redMrSrc);
  expect(lockedSrcAfterToggleBack).toBe(lockedSrc);
  expect(lockedSrcAfterToggleBack).not.toBe(redMrSrcAgain);

  await guestPage.locator('#join-avatar-picker .avatar-option[data-avatar="green"]').click();
  await guestPage.getByRole("button", { name: "Join room" }).click();
  await expect(guestPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(guestPage.locator("#score-columns")).toContainText("Mrs Yellow");
  await expect(guestPage.locator("#score-columns")).toContainText("Mr Green");
  await expect(guestPage.locator("#score-columns .score-duel-panel")).toHaveCount(1);
  await expect(guestPage.locator("#score-columns .score-duel-side")).toHaveCount(2);
  await expect(guestPage.locator("#score-columns .score-duel-meta")).toHaveCount(2);
  await expect(guestPage.locator("#score-columns .score-duel-name")).toHaveCount(2);
  await expect(guestPage.locator("#score-columns .score-duel-points")).toHaveCount(2);
  await expect(guestPage.locator("#score-columns .score-duel-scorebar-wrap")).toHaveCount(0);
  await expect(guestPage.locator("#score-columns .score-broadcast-row")).toHaveCount(0);
  await expect(guestPage.locator("#score-columns .score-role")).toHaveCount(0);
  await expect(guestPage.locator("#score-columns .score-column")).toHaveCount(0);

  await hostContext.close();
  await guestContext.close();
});

test("online pick can launch poker dice module", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  await gotoApp(hostPage);
  await hostPage.getByRole("button", { name: "Online" }).click();
  await hostPage.getByRole("button", { name: "Host a room" }).click();
  await hostPage.locator('#host-avatar-picker .avatar-option[data-avatar="yellow"]').click();
  await hostPage.getByRole("button", { name: "Continue" }).click();
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  const roomCode = (await hostPage.locator("#room-code").textContent())?.trim() || "";

  await gotoApp(guestPage);
  await guestPage.getByRole("button", { name: "Online" }).click();
  await guestPage.getByRole("button", { name: "Join a room" }).click();
  await fillJoinCodeSlots(guestPage, roomCode);
  await expect(guestPage.locator("#join-avatar-picker:not(.hidden)")).toBeVisible();
  await guestPage.locator('#join-avatar-picker .avatar-option[data-avatar="green"]').click();
  await guestPage.getByRole("button", { name: "Join room" }).click();
  await expect(guestPage.locator("#screen-lobby.active")).toBeVisible();

  const hostPokerDiceCta = gameCta(hostPage, "Poker Dice");
  const guestPokerDiceCta = gameCta(guestPage, "Poker Dice");
  await hostPokerDiceCta.click();
  await expect(hostPokerDiceCta).toHaveText("Selected");
  await expect(guestPokerDiceCta).toHaveText("Agree");
  await guestPokerDiceCta.click();
  await expect(hostPokerDiceCta).toHaveText(/Starting in [1-3]/, { timeout: 1500 });
  await expect(guestPokerDiceCta).toHaveText(/Starting in [1-3]/, { timeout: 1500 });

  await expect(hostPage.locator("#screen-game.active")).toBeVisible({ timeout: 15000 });
  await expect(guestPage.locator("#screen-game.active")).toBeVisible({ timeout: 15000 });
  await expect(hostPage.locator("#poker-dice-layout")).not.toHaveClass(/hidden/);
  await expect(guestPage.locator("#poker-dice-layout")).not.toHaveClass(/hidden/);
  await expect(hostPage.locator("#poker-dice-dice .poker-die")).toHaveCount(6);
  await expect(guestPage.locator("#poker-dice-dice .poker-die")).toHaveCount(6);
  await expect(hostPage.locator("#poker-dice-layout .poker-dice-score-guide")).toBeVisible();
  await expect(guestPage.locator("#poker-dice-layout .poker-dice-score-guide")).toBeVisible();
  await expect(hostPage.locator("#poker-dice-layout .poker-dice-score-row")).toHaveCount(9);
  await expect(guestPage.locator("#poker-dice-layout .poker-dice-score-row")).toHaveCount(9);
  await expect(hostPage.locator("#poker-dice-info")).toHaveCount(0);
  await expect(guestPage.locator("#poker-dice-info")).toHaveCount(0);
  await expect(hostPage.locator("#poker-dice-info-modal")).toHaveCount(0);
  await expect(guestPage.locator("#poker-dice-info-modal")).toHaveCount(0);

  await hostContext.close();
  await guestContext.close();
});

test("join code slots sanitize ambiguous letters and support paste/backspace flow", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  await gotoApp(hostPage);
  await hostPage.getByRole("button", { name: "Online" }).click();
  await hostPage.getByRole("button", { name: "Host a room" }).click();
  await hostPage.locator('#host-avatar-picker .avatar-option[data-avatar="yellow"]').click();
  await hostPage.getByRole("button", { name: "Continue" }).click();
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  const roomCode = (await hostPage.locator("#room-code").textContent())?.trim() || "";

  await gotoApp(guestPage);
  await guestPage.getByRole("button", { name: "Online" }).click();
  await guestPage.getByRole("button", { name: "Join a room" }).click();
  await expect(guestPage.locator("#screen-join.active")).toBeVisible();

  await guestPage.locator("#join-code-slot-0").fill("A0IO");
  await expect(guestPage.locator("#join-code")).toHaveValue("A");
  await expect(guestPage.locator("#join-code-slot-0")).toHaveValue("A");
  await expect(guestPage.locator("#join-code-slot-1")).toHaveValue("");
  await expect(guestPage.getByRole("button", { name: "Continue" })).toBeDisabled();

  await guestPage.locator("#join-code-slot-1").focus();
  await guestPage.keyboard.press("Backspace");
  await expect(guestPage.locator("#join-code-slot-0")).toBeFocused();
  await expect(guestPage.locator("#join-code-slot-0")).toHaveValue("");
  await expect(guestPage.locator("#join-code")).toHaveValue("");

  await guestPage.evaluate((value) => {
    const slot = document.getElementById("join-code-slot-0");
    if (!(slot instanceof HTMLInputElement)) return;
    slot.value = value;
    slot.dispatchEvent(new Event("input", { bubbles: true }));
  }, roomCode);
  await expect(guestPage.locator("#join-code")).toHaveValue(roomCode);
  await expect(guestPage.locator("#join-avatar-picker:not(.hidden)")).toBeVisible();

  await hostContext.close();
  await guestContext.close();
});
