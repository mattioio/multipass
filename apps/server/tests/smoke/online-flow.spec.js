import { expect, test } from "@playwright/test";

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

test("online happy path: host + guest choose game -> game", async ({ browser }) => {
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
  await fillJoinCodeSlots(guestPage, roomCode);
  await expect(guestPage.locator("#join-avatar-picker:not(.hidden)")).toBeVisible();
  await expect(guestPage.getByRole("button", { name: "Join room" })).toBeVisible();
  await guestPage.locator('#join-avatar-picker .avatar-option[data-avatar="green"]').click();
  await guestPage.getByRole("button", { name: "Join room" }).click();

  await expect(guestPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(hostPage.locator("#score-columns .score-duel-panel")).toHaveCount(1);
  await expect(hostPage.locator("#score-columns .score-duel-side")).toHaveCount(2);
  await expect(hostPage.locator("#score-columns .score-duel-scorebar-wrap")).toHaveCount(1);
  await expect(hostPage.locator("#score-columns .score-broadcast-row")).toHaveCount(1);
  await expect(hostPage.locator("#score-columns .score-role")).toHaveCount(0);
  await expect(hostPage.locator("#score-columns .score-column")).toHaveCount(0);

  await hostPage.getByRole("button", { name: "Pick a game" }).click();
  await guestPage.getByRole("button", { name: "Pick a game" }).click();

  await expect(hostPage.locator("#screen-pick.active")).toBeVisible();
  await expect(guestPage.locator("#screen-pick.active")).toBeVisible();

  await hostPage.getByRole("button", { name: "Play Tic Tac Toe" }).click();
  await guestPage.getByRole("button", { name: "Play Tic Tac Toe" }).click();

  await expect(hostPage.locator("#screen-game.active")).toBeVisible();
  await expect(guestPage.locator("#screen-game.active")).toBeVisible();
  await expect(hostPage.locator("#screen-game .game-surface-head")).toHaveCount(0);
  await expect(hostPage.locator("#screen-game .game-surface-title")).toHaveCount(0);
  await expect(hostPage.locator("#screen-game .game-surface-status")).toHaveCount(0);
  await expect(guestPage.locator("#screen-game .game-surface-head")).toHaveCount(0);
  await expect(guestPage.locator("#screen-game .game-surface-title")).toHaveCount(0);
  await expect(guestPage.locator("#screen-game .game-surface-status")).toHaveCount(0);
  await expect(hostPage.locator("#turn-indicator .turn-player")).toHaveCount(2);
  await expect(guestPage.locator("#turn-indicator .turn-player")).toHaveCount(2);
  await expect(hostPage.locator("#turn-indicator .turn-player-score-match")).toHaveCount(0);
  await expect(hostPage.locator("#turn-indicator .turn-player-score-game")).toHaveCount(0);
  await expect(guestPage.locator("#turn-indicator .turn-player-score-match")).toHaveCount(0);
  await expect(guestPage.locator("#turn-indicator .turn-player-score-game")).toHaveCount(0);
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

test("online dots and boxes syncs edge moves across host and guest", async ({ browser }) => {
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
  await fillJoinCodeSlots(guestPage, roomCode);
  await expect(guestPage.locator("#join-avatar-picker:not(.hidden)")).toBeVisible();
  await guestPage.locator('#join-avatar-picker .avatar-option[data-avatar="green"]').click();
  await guestPage.getByRole("button", { name: "Join room" }).click();

  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(guestPage.locator("#screen-lobby.active")).toBeVisible();

  await hostPage.getByRole("button", { name: "Pick a game" }).click();
  await guestPage.getByRole("button", { name: "Pick a game" }).click();
  await hostPage.getByRole("button", { name: "Play Dots & Boxes" }).click();
  await guestPage.getByRole("button", { name: "Play Dots & Boxes" }).click();

  await expect(hostPage.locator("#screen-game.active")).toBeVisible();
  await expect(guestPage.locator("#screen-game.active")).toBeVisible();
  await expect(hostPage.locator("#dots-layout")).not.toHaveClass(/hidden/);
  await expect(guestPage.locator("#dots-layout")).not.toHaveClass(/hidden/);
  await expect(hostPage.locator("#dots-board .dots-edge")).toHaveCount(60);
  await expect(guestPage.locator("#dots-board .dots-edge")).toHaveCount(60);
  await expect(hostPage.locator("#turn-indicator .turn-player-score-match")).toHaveCount(0);
  await expect(hostPage.locator("#turn-indicator .turn-player-score-game")).toHaveCount(2);
  await expect(guestPage.locator("#turn-indicator .turn-player-score-match")).toHaveCount(0);
  await expect(guestPage.locator("#turn-indicator .turn-player-score-game")).toHaveCount(2);

  const starter = await hostPage.evaluate(() => window.__multipassStore.getState().room.game.state.nextPlayerId);
  const hostPlayerId = await hostPage.evaluate(() => window.__multipassStore.getState().room.players.host.id);
  expect(starter).toBe(hostPlayerId);
  await expect(hostPage.locator("#turn-indicator .turn-player-host .turn-player-state")).toHaveText("Turn");
  await expect(hostPage.locator("#turn-indicator .turn-player-guest .turn-player-state")).toHaveText("Waiting");
  await expect(hostPage.locator("#turn-indicator .turn-player-host .turn-player-score-game")).toHaveText("0");
  await expect(hostPage.locator("#turn-indicator .turn-player-guest .turn-player-score-game")).toHaveText("0");
  const mirroredHostLayout = await hostPage.evaluate(() => {
    const guestPane = document.querySelector("#turn-indicator .turn-player-guest");
    const guestMeta = document.querySelector("#turn-indicator .turn-player-guest .turn-player-meta");
    if (!(guestPane instanceof HTMLElement) || !(guestMeta instanceof HTMLElement)) return null;
    return {
      guestFlexDirection: getComputedStyle(guestPane).flexDirection,
      guestMetaTextAlign: getComputedStyle(guestMeta).textAlign
    };
  });
  expect(mirroredHostLayout).not.toBeNull();
  expect(mirroredHostLayout?.guestFlexDirection).toBe("row-reverse");
  expect(mirroredHostLayout?.guestMetaTextAlign).toBe("right");
  const mirroredGuestLayout = await guestPage.evaluate(() => {
    const guestPane = document.querySelector("#turn-indicator .turn-player-guest");
    const guestMeta = document.querySelector("#turn-indicator .turn-player-guest .turn-player-meta");
    if (!(guestPane instanceof HTMLElement) || !(guestMeta instanceof HTMLElement)) return null;
    return {
      guestFlexDirection: getComputedStyle(guestPane).flexDirection,
      guestMetaTextAlign: getComputedStyle(guestMeta).textAlign
    };
  });
  expect(mirroredGuestLayout).not.toBeNull();
  expect(mirroredGuestLayout?.guestFlexDirection).toBe("row-reverse");
  expect(mirroredGuestLayout?.guestMetaTextAlign).toBe("right");
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
  await expect(hostPage.locator("#turn-indicator .turn-player-host .turn-player-state")).toHaveText("Waiting");
  await expect(hostPage.locator("#turn-indicator .turn-player-guest .turn-player-state")).toHaveText("Turn");

  await clickEdge(guestPage, 10, 2);
  await clickEdge(hostPage, 30, 3);
  await clickEdge(guestPage, 11, 4);
  await clickEdge(hostPage, 5, 5);
  await clickEdge(guestPage, 12, 6);
  await expect(hostPage.locator('#dots-board .dots-edge[data-edge-index="31"]')).toHaveClass(/is-scoring-opportunity/);
  await expect(hostPage.locator("#turn-indicator .turn-player-host .turn-player-state")).toHaveText("Turn");
  await expect(hostPage.locator("#turn-indicator .turn-player-guest .turn-player-state")).toHaveText("Waiting");

  await clickEdge(hostPage, 31, 7);
  await expect(hostPage.locator("#dots-board .dots-edge.is-last-move")).toHaveCount(1);
  await expect(guestPage.locator("#dots-board .dots-edge.is-last-move")).toHaveCount(1);
  await expect(hostPage.locator("#turn-indicator .turn-player-host .turn-player-score-game")).toHaveText("1");
  await expect(guestPage.locator("#turn-indicator .turn-player-host .turn-player-score-game")).toHaveText("1");
  await expect(hostPage.locator("#turn-indicator .turn-player-host .turn-player-state")).toHaveText("Turn");
  await expect(hostPage.locator("#turn-indicator .turn-player-guest .turn-player-state")).toHaveText("Waiting");

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
  await fillJoinCodeSlots(guestPage, roomCode);
  await expect(guestPage.locator("#join-avatar-picker:not(.hidden)")).toBeVisible();
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

test("online honorific picker is independent per player", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  await hostPage.goto("http://127.0.0.1:3000/");
  await hostPage.getByRole("tab", { name: "Online" }).click();
  await hostPage.getByRole("button", { name: "Host a room" }).click();
  await hostPage.locator("#host-honorific-toolbar .switch").click();
  await hostPage.locator('#host-avatar-picker .avatar-option[data-avatar="yellow"]').click();
  await hostPage.getByRole("button", { name: "Continue" }).click();
  await expect(hostPage.locator("#screen-lobby.active")).toBeVisible();
  await expect(hostPage.locator("#score-columns")).toContainText("Mrs Yellow");
  const roomCode = (await hostPage.locator("#room-code").textContent())?.trim() || "";

  await guestPage.goto("http://127.0.0.1:3000/");
  await guestPage.getByRole("tab", { name: "Online" }).click();
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
  await expect(guestPage.locator("#score-columns .score-duel-scorebar-wrap")).toHaveCount(1);
  await expect(guestPage.locator("#score-columns .score-broadcast-row")).toHaveCount(1);
  await expect(guestPage.locator("#score-columns .score-role")).toHaveCount(0);
  await expect(guestPage.locator("#score-columns .score-column")).toHaveCount(0);

  await hostContext.close();
  await guestContext.close();
});

test("join code slots sanitize ambiguous letters and support paste/backspace flow", async ({ browser }) => {
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
