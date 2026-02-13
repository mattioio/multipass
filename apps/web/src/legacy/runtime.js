import { assertRoomShape } from "../contracts/roomState.js";
import { FRUITS, getFruit, getFruitByTheme } from "../domain/fruits.js";
import { localGames, listLocalGames } from "../domain/localGames.js";
import { createWsClient } from "../net/wsClient.js";
import { actions } from "../state/actions.js";
import { reducer } from "../state/reducer.js";
import { getLeaderId } from "../state/selectors.js";
import { createStore } from "../state/store.js";
import { renderLocalSetupScreen } from "../ui/screens/localSetup.js";
import { renderPickHint } from "../ui/screens/pickHint.js";
import { setupFruitPicker, updateFruitPicker } from "../ui/shared/fruitPicker.js";
import { createToastController } from "../ui/shared/toast.js";

const LOCAL_REJOIN_KEY = "multipass_last_local_match";
const ONLINE_REJOIN_AT_KEY = "multipass_last_room_started_at";
const ONLINE_UI_PREFS_KEY = "multipass_online_ui_prefs";
const SEAT_TOKEN_KEY = "multipass_seat_token";
const SCREEN_TO_HASH = Object.freeze({
  landing: "#landing",
  local: "#local",
  host: "#host",
  join: "#join",
  lobby: "#lobby",
  pick: "#pick",
  wait: "#wait",
  game: "#game",
  shuffle: "#shuffle",
  winner: "#winner"
});
const HASH_TO_SCREEN = Object.freeze(
  Object.fromEntries(Object.entries(SCREEN_TO_HASH).map(([screen, hash]) => [hash, screen]))
);
const ROOM_REQUIRED_SCREENS = new Set(["lobby", "pick", "wait", "game", "shuffle", "winner"]);
const SHUFFLE_CLOCKWISE_ORDER = [0, 1, 3, 2];
const SHUFFLE_AUTO_STOP_MS = 2200;
const SHUFFLE_STEP_MS = 115;
const SHUFFLE_SETTLE_MIN_STEPS = 7;
const LEGACY_BOOTSTRAP_FLAG = "__multipassLegacyInitialized";

function createInitialLocalStripState() {
  return {
    isAnimating: false,
    isSettling: false,
    activeIndex: 0,
    finalIndex: null,
    winnerId: null,
    stepTimer: null,
    autoStopTimer: null,
    gridSignature: ""
  };
}

function createInitialState() {
  return {
    ws: null,
    clientId: localStorage.getItem("multipass_client_id"),
    seatToken: localStorage.getItem(SEAT_TOKEN_KEY),
    room: null,
    you: null,
    mode: "online",
    activeScreen: "landing",
    keepPickOpen: false,
    lastScreen: localStorage.getItem("multipass_last_screen"),
    lastRoomCode: localStorage.getItem("multipass_last_room"),
    lastRoomStartedAt: Number(localStorage.getItem(ONLINE_REJOIN_AT_KEY)) || null,
    autoJoinCode: null,
    shuffleTimer: null,
    lastLeaderId: null,
    lastWinSignature: null,
    hostFruit: null,
    joinFruit: null,
    joinStep: "code",
    joinValidatedCode: null,
    joinPreview: null,
    joinValidating: false,
    localRejoinSnapshot: null,
    localFruits: { one: null, two: null },
    localStep: "p1",
    prevLocalStep: "p1",
    settingsLastFocus: null,
    deferredInstallPrompt: null,
    isAppInstalled: false,
    localHasSpun: false,
    landingMode: "local",
    localStrip: createInitialLocalStripState()
  };
}

const store = createStore(createInitialState(), reducer);
const state = store.getState();
const dispatch = store.dispatch;
const wsClient = createWsClient({ getUrl: getWebSocketUrl });
window.__multipassStore = store;

const screens = {
  landing: document.getElementById("screen-landing"),
  local: document.getElementById("screen-local"),
  host: document.getElementById("screen-host"),
  join: document.getElementById("screen-join"),
  lobby: document.getElementById("screen-lobby"),
  pick: document.getElementById("screen-pick"),
  wait: document.getElementById("screen-wait"),
  game: document.getElementById("screen-game"),
  shuffle: document.getElementById("screen-shuffle"),
  winner: document.getElementById("screen-winner")
};
const landingTrack = document.getElementById("landing-track");
const landingSegmented = document.querySelector(".landing-segmented");
const landingTabLocal = document.getElementById("landing-tab-local");
const landingTabOnline = document.getElementById("landing-tab-online");
const landingPanelLocal = document.getElementById("landing-panel-local");
const landingPanelOnline = document.getElementById("landing-panel-online");

const toast = createToastController();
const showToast = toast.showToast;
const showActionToast = toast.showActionToast;
const hideActionToast = toast.hideActionToast;
const actionToastCta = toast.actionToastCta;

function staggerLandingPanel(panel) {
  if (!(panel instanceof HTMLElement)) return;
  const children = Array.from(panel.children).filter((child) => {
    if (!(child instanceof HTMLElement)) return false;
    return !child.classList.contains("hidden");
  });
  panel.classList.remove("is-staggering");
  children.forEach((child) => {
    child.classList.remove("is-entered");
    child.style.removeProperty("--item-index");
  });
  if (!children.length) return;
  children.forEach((child, index) => {
    child.style.setProperty("--item-index", String(index));
  });
  panel.classList.add("is-staggering");
  requestAnimationFrame(() => {
    children.forEach((child) => child.classList.add("is-entered"));
  });
}

function parseScreenHash(hash = window.location.hash) {
  const normalized = String(hash || "").trim().toLowerCase();
  return HASH_TO_SCREEN[normalized] || null;
}

function toScreenHash(screen) {
  return SCREEN_TO_HASH[screen] || SCREEN_TO_HASH.landing;
}

function sameHistoryState(expected = {}) {
  const current = window.history.state;
  if (!current || typeof current !== "object") return false;
  return Object.entries(expected).every(([key, value]) => current[key] === value);
}

function writeScreenHash(screen, options = {}) {
  const mode = options.mode || "push";
  const historyState = options.historyState || {};
  const allowSameHashPush = Boolean(options.allowSameHashPush);
  if (mode === "none") return;

  const nextHash = toScreenHash(screen);
  const currentHash = window.location.hash || "";
  const nextState = { screen, ...historyState };
  const currentPath = `${window.location.pathname}${window.location.search}`;
  const nextUrl = `${currentPath}${nextHash}`;

  if (mode === "replace") {
    if (currentHash === nextHash && sameHistoryState(nextState)) return;
    window.history.replaceState(nextState, "", nextUrl);
    return;
  }

  if (!allowSameHashPush && currentHash === nextHash) return;
  window.history.pushState(nextState, "", nextUrl);
}

function applyMode(mode, persist = false) {
  document.body.dataset.mode = mode;
  document.body.dataset.uiVariant = mode === "dark" ? "neon_night" : "soft";
  const toggle = document.getElementById("mode-toggle");
  if (toggle) toggle.checked = mode === "dark";
  if (persist) localStorage.setItem("multipass_mode", mode);
}

function initModeToggle() {
  const toggle = document.getElementById("mode-toggle");
  const stored = localStorage.getItem("multipass_mode");
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  if (stored) {
    applyMode(stored);
  } else {
    applyMode(media.matches ? "dark" : "light");
  }

  media.addEventListener("change", (event) => {
    if (localStorage.getItem("multipass_mode")) return;
    applyMode(event.matches ? "dark" : "light");
  });

  if (toggle) {
    toggle.addEventListener("change", () => {
      applyMode(toggle.checked ? "dark" : "light", true);
    });
  }
}

function normalizeTargetScreen(screen) {
  if (!screen || !(screen in screens)) return "landing";
  if (ROOM_REQUIRED_SCREENS.has(screen) && !state.room) return "landing";
  if (screen === "game" && (!state.room?.game || state.room.round?.status === "shuffling")) {
    return state.room ? resolveScreen(state.room) : "landing";
  }
  if (screen === "winner") {
    const gameState = state.room?.game?.state;
    const ended = Boolean(gameState?.winnerId || gameState?.draw);
    return ended ? "winner" : (state.room ? resolveScreen(state.room) : "landing");
  }
  if (screen === "shuffle" && state.room?.round?.status !== "shuffling") {
    return state.room ? resolveScreen(state.room) : "landing";
  }
  return screen;
}

function handleBrowserNavigation(targetScreen) {
  const normalizedTarget = normalizeTargetScreen(targetScreen);

  const navigatingAwayFromRoom = !ROOM_REQUIRED_SCREENS.has(normalizedTarget);
  if (navigatingAwayFromRoom && state.room) {
    if (isLocalMode()) {
      leaveLocalMatch({ saveForRejoin: true, history: "replace" });
    } else {
      leaveRoom({ history: "replace" });
    }
    return;
  }

  showScreen(normalizedTarget, { history: "none" });
  writeScreenHash(normalizedTarget, { mode: "replace" });
}

function initHashRouting() {
  window.addEventListener("hashchange", () => {
    const target = parseScreenHash(window.location.hash) || "landing";
    handleBrowserNavigation(target);
  });

  window.addEventListener("popstate", (event) => {
    const routeScreen = parseScreenHash(window.location.hash);
    const stateScreen = event.state?.screen;
    const target = normalizeTargetScreen(routeScreen || stateScreen || "landing");

    handleBrowserNavigation(target);
  });

  const initialTarget = normalizeTargetScreen(parseScreenHash(window.location.hash) || "landing");
  showScreen(initialTarget, { history: "none" });
  writeScreenHash(initialTarget, { mode: "replace" });
}

function showScreen(key, options = {}) {
  const historyMode = options.history || "push";
  const historyState = options.historyState || {};
  const allowSameHashPush = Boolean(options.allowSameHashPush);
  state.activeScreen = key;
  document.body.dataset.screen = key;
  localStorage.setItem("multipass_last_screen", key);
  Object.entries(screens).forEach(([name, element]) => {
    element.classList.toggle("active", name === key);
  });
  writeScreenHash(key, {
    mode: historyMode,
    historyState,
    allowSameHashPush
  });
  updateHeroActions();
  updateHeroRoomCodeVisibility();
}

function getHeroActionConfig() {
  if (state.activeScreen === "landing") {
    const installAction = getInstallActionConfig();
    return installAction;
  }
  if (state.activeScreen === "local") {
    if (state.localStep === "p2") {
      return { label: "Back", action: () => {
        state.localStep = "p1";
        writeScreenHash("local", { mode: "replace", historyState: { localStep: "p1" } });
        renderLocalSetup();
      } };
    }
    return { label: "Back", action: () => showScreen("landing", { history: "push" }) };
  }
  if (state.activeScreen === "host" || state.activeScreen === "join") {
    return { label: "Back", action: () => showScreen("landing", { history: "push" }) };
  }
  if (isLocalMode() && state.room && (
    state.activeScreen === "lobby" ||
    state.activeScreen === "pick" ||
    state.activeScreen === "shuffle" ||
    state.activeScreen === "game" ||
    state.activeScreen === "winner"
  )) {
    return { label: "Close", action: () => leaveLocalMatch({ saveForRejoin: true }) };
  }
  if (!isLocalMode() && state.room && state.activeScreen === "lobby") {
    return { label: "Exit", action: () => leaveRoom() };
  }
  if (state.activeScreen === "pick") {
    return { label: "Back", action: () => {
      state.keepPickOpen = false;
      if (isLocalMode()) {
        showScreen("lobby", { history: "push" });
        return;
      }
      if (state.room?.code) {
        setPreferredRoomScreen(state.room.code, "lobby");
      }
      showScreen("lobby", { history: "push" });
    } };
  }
  if (state.activeScreen === "game") {
    return { label: "Exit", action: () => leaveRoom() };
  }
  if (state.activeScreen === "winner") {
    return { label: "Back", action: () => leaveRoom() };
  }
  return null;
}

function updateHeroActions() {
  const button = document.getElementById("hero-left-action");
  if (!button) return;
  const config = getHeroActionConfig();
  if (!config) {
    button.classList.add("hidden");
    button.onclick = null;
    return;
  }
  button.classList.remove("hidden");
  button.textContent = config.label;
  button.onclick = config.action;
}

function isiOSBrowser() {
  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean(window.navigator.standalone);
}

function getInstallActionConfig() {
  if (state.isAppInstalled || isStandaloneMode()) return null;
  if (state.deferredInstallPrompt) {
    return { label: "Install", action: promptInstallApp };
  }
  if (isiOSBrowser()) {
    return {
      label: "Install",
      action: () => showToast("Use Share → Add to Home Screen.")
    };
  }
  return null;
}

async function promptInstallApp() {
  const deferred = state.deferredInstallPrompt;
  if (!deferred) return;
  try {
    await deferred.prompt();
    await deferred.userChoice;
  } catch (err) {
    // ignore install prompt failures
  }
  state.deferredInstallPrompt = null;
  updateHeroActions();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV;
  if (isDev) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().catch(() => {
            // ignore cleanup failures in dev
          });
        });
      }).catch(() => {
        // ignore cleanup failures in dev
      });
    });
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // ignore registration failures in unsupported contexts
    });
  });
}

function initInstallPromptHandling() {
  state.isAppInstalled = isStandaloneMode();
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    updateHeroActions();
  });
  window.addEventListener("appinstalled", () => {
    state.deferredInstallPrompt = null;
    state.isAppInstalled = true;
    updateHeroActions();
  });
}

function getWebSocketUrl() {
  const envOverride = typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_WS_URL
    : null;
  if (envOverride) return envOverride;
  const override = window.localStorage?.getItem("multipass_ws_url");
  if (override) return override;
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.hostname}:3001`;
  }
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.host}`;
  }
  return "wss://api.loreandorder.com";
}

function connect() {
  const socket = wsClient.connect();
  dispatch(actions.wsSet(socket));

  wsClient.subscribe("open", () => {
    if (state.lastRoomCode && state.mode === "online") {
      dispatch(actions.autoJoinCodeSet(state.lastRoomCode));
      send({
        type: "join_room",
        code: state.lastRoomCode,
        clientId: state.clientId,
        seatToken: state.seatToken
      });
    }
  });

  wsClient.subscribe("message", (message) => {
    if (message.type === "session") {
      dispatch(actions.clientIdSet(message.clientId));
      localStorage.setItem("multipass_client_id", message.clientId);
      if (typeof message.seatToken === "string" && message.seatToken) {
        state.seatToken = message.seatToken;
        localStorage.setItem(SEAT_TOKEN_KEY, message.seatToken);
      }
      return;
    }

    if (message.type === "room_state") {
      if (state.mode === "local") {
        return;
      }
      if (!assertRoomShape(message.room)) {
        return;
      }
      dispatch(actions.wsRoomStateReceived(message.room, message.you));
      dispatch(actions.autoJoinCodeSet(null));
      if (state.room?.code) {
        dispatch(actions.lastRoomCodeSet(state.room.code));
        setOnlineRejoinData(state.room.code, state.room.createdAt || Date.now());
      }
      const currentEndSignature = getEndSignature(state.room);
      if (!currentEndSignature) {
        clearDismissedWinnerSignature(state.room?.code);
      } else {
        const dismissedSignature = getDismissedWinnerSignature(state.room?.code);
        if (dismissedSignature && dismissedSignature !== currentEndSignature) {
          clearDismissedWinnerSignature(state.room?.code);
        }
      }
      updateRejoinCard();
      const nextScreen = resolveScreen(state.room);
      if (nextScreen === "shuffle" && state.activeScreen !== "shuffle") {
        showScreen("shuffle", { history: "replace" });
      }
      renderRoom();
      const endSignature = getEndSignature(state.room);
      if (endSignature && endSignature !== state.lastWinSignature) {
        state.lastWinSignature = endSignature;
        const dismissedSignature = getDismissedWinnerSignature(state.room?.code);
        if (dismissedSignature !== endSignature) {
          showScreen("winner", { history: "replace" });
          return;
        }
      }
      if (state.activeScreen === "shuffle" && nextScreen === "game") {
        clearTimeout(state.shuffleTimer);
        state.shuffleTimer = setTimeout(() => {
          if (state.activeScreen === "shuffle") {
            showScreen("game", { history: "replace" });
          }
        }, 900);
        return;
      }
      showScreen(nextScreen, { history: "replace" });
      return;
    }

    if (message.type === "room_preview") {
      state.joinValidating = false;
      state.joinPreview = message.room || null;
      state.joinValidatedCode = message.room?.code || null;
      const canRejoin = Boolean(message.room?.canRejoin);
      if (canRejoin) {
        state.joinStep = "code";
        state.joinValidating = true;
        renderJoinSetup();
        send({
          type: "join_room",
          code: state.joinValidatedCode,
          clientId: state.clientId,
          seatToken: state.seatToken
        });
        return;
      }
      state.joinStep = "fruit";
      state.joinFruit = null;
      renderJoinSetup();
      return;
    }

    if (message.type === "error") {
      if (state.joinValidating) {
        state.joinValidating = false;
        renderJoinSetup();
      }
      if (state.autoJoinCode) {
        if (message.message === "Room not found.") {
          dispatch(actions.autoJoinCodeSet(null));
          dispatch(actions.lastRoomCodeSet(null));
          clearOnlineRejoinData();
          updateRejoinCard();
          showToast("Room expired.");
          showScreen("landing", { history: "replace" });
          return;
        }
        if (message.message === "Pick a fruit.") {
          dispatch(actions.autoJoinCodeSet(null));
          const joinCodeInput = document.getElementById("join-code");
          if (joinCodeInput && state.lastRoomCode) {
            joinCodeInput.value = state.lastRoomCode;
          }
          showToast("Pick a fruit to rejoin.");
          showScreen("join", { history: "replace" });
          return;
        }
      }
      showToast(message.message || "Something went wrong.");
      return;
    }
  });

  wsClient.subscribe("close", () => {
    showToast("Disconnected. Refresh to reconnect.");
  });
}

function send(payload) {
  const socket = wsClient.getSocket();
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    showToast("Connecting...");
    return;
  }
  wsClient.send(payload);
}

function playerById(room, id) {
  if (!id || !room) return null;
  const list = [room.players.host, room.players.guest].filter(Boolean);
  return list.find((entry) => entry.id === id) || null;
}

function getGameName(room, gameId) {
  if (!room || !gameId) return null;
  const found = (room.games || []).find((game) => game.id === gameId);
  return found ? found.name : gameId;
}

function getGameBannerClass(game) {
  const key = game?.bannerKey || game?.id || "";
  if (key === "battleships") return "game-banner-battleships";
  if (key === "zombie_dice") return "game-banner-zombie-dice";
  return "game-banner-tic-tac-toe";
}

function getGameBannerLabel(game) {
  const key = game?.bannerKey || game?.id || "";
  if (key === "battleships") return "Fleet Clash";
  if (key === "zombie_dice") return "Brains Or Bust";
  return "Classic Grid Duel";
}

function isLocalMode() {
  return state.mode === "local";
}

function shouldShowHeroRoomCode() {
  return !isLocalMode() && state.activeScreen === "lobby" && Boolean(state.room?.code);
}

function updateHeroRoomCodeVisibility() {
  const heroRoom = document.getElementById("hero-room");
  if (!heroRoom) return;
  heroRoom.classList.toggle("hidden", !shouldShowHeroRoomCode());
}

function loadOnlineUiPrefs() {
  const raw = localStorage.getItem(ONLINE_UI_PREFS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch (err) {
    return {};
  }
}

function saveOnlineUiPrefs(prefs) {
  try {
    localStorage.setItem(ONLINE_UI_PREFS_KEY, JSON.stringify(prefs));
  } catch (err) {
    // ignore persistence failures
  }
}

function getRoomUiPrefs(roomCode) {
  if (!roomCode) return null;
  const prefs = loadOnlineUiPrefs();
  const roomPrefs = prefs[roomCode];
  if (!roomPrefs || typeof roomPrefs !== "object") return null;
  return roomPrefs;
}

function updateRoomUiPrefs(roomCode, patch) {
  if (!roomCode) return;
  const prefs = loadOnlineUiPrefs();
  const roomPrefs = prefs[roomCode] && typeof prefs[roomCode] === "object" ? prefs[roomCode] : {};
  prefs[roomCode] = { ...roomPrefs, ...patch };
  saveOnlineUiPrefs(prefs);
}

function setPreferredRoomScreen(roomCode, screen) {
  if (!roomCode) return;
  if (screen !== "lobby" && screen !== "pick") return;
  updateRoomUiPrefs(roomCode, { preferredRoomScreen: screen });
}

function setDismissedWinnerSignature(roomCode, signature) {
  if (!roomCode) return;
  updateRoomUiPrefs(roomCode, { dismissedWinnerSignature: signature || null });
}

function clearDismissedWinnerSignature(roomCode) {
  if (!roomCode) return;
  updateRoomUiPrefs(roomCode, { dismissedWinnerSignature: null });
}

function getPreferredRoomScreen(roomCode) {
  const roomPrefs = getRoomUiPrefs(roomCode);
  const preferred = roomPrefs?.preferredRoomScreen;
  if (preferred === "pick" || preferred === "lobby") return preferred;
  return "lobby";
}

function getDismissedWinnerSignature(roomCode) {
  const roomPrefs = getRoomUiPrefs(roomCode);
  return roomPrefs?.dismissedWinnerSignature || null;
}

function localId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatStartedAgo(startedAt) {
  if (!startedAt) return "Started a bit ago.";
  const elapsedMs = Math.max(0, Date.now() - startedAt);
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  if (elapsedMinutes < 1) return "Started just now.";
  if (elapsedMinutes < 60) return `Started about ${elapsedMinutes} min ago.`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Started about ${elapsedHours} hr ago.`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `Started about ${elapsedDays} day ago${elapsedDays === 1 ? "" : "s"}.`;
}

function getLocalRejoinLabel(snapshot) {
  const startedAt = Number(snapshot?.room?.createdAt) || Number(snapshot?.savedAt) || null;
  return formatStartedAgo(startedAt);
}

function setOnlineRejoinData(roomCode, startedAt) {
  if (!roomCode) return;
  const normalizedCode = String(roomCode).trim().toUpperCase();
  if (!normalizedCode) return;
  const normalizedStartedAt = Number(startedAt) || Date.now();
  const shouldPreserveStart = state.lastRoomCode === normalizedCode && Number(state.lastRoomStartedAt);
  state.lastRoomCode = normalizedCode;
  state.lastRoomStartedAt = shouldPreserveStart ? Number(state.lastRoomStartedAt) : normalizedStartedAt;
  localStorage.setItem("multipass_last_room", state.lastRoomCode);
  localStorage.setItem(ONLINE_REJOIN_AT_KEY, String(state.lastRoomStartedAt));
}

function clearOnlineRejoinData() {
  state.lastRoomCode = null;
  state.lastRoomStartedAt = null;
  localStorage.removeItem("multipass_last_room");
  localStorage.removeItem(ONLINE_REJOIN_AT_KEY);
}

function isValidLocalRejoinSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  if (snapshot.mode !== "local") return false;
  if (!snapshot.room || typeof snapshot.room !== "object") return false;
  const host = snapshot.room.players?.host;
  const guest = snapshot.room.players?.guest;
  if (!host?.id || !guest?.id) return false;
  if (!snapshot.room.round || typeof snapshot.room.round !== "object") return false;
  return true;
}

function saveLocalRejoinSnapshot(room, meta = {}) {
  if (!room) return;
  const snapshot = {
    version: 1,
    mode: "local",
    savedAt: Date.now(),
    localHasSpun: Boolean(meta.localHasSpun ?? state.localHasSpun),
    localShuffleIndex: Number.isFinite(meta.localShuffleIndex) ? meta.localShuffleIndex : state.localStrip.activeIndex,
    room
  };
  try {
    localStorage.setItem(LOCAL_REJOIN_KEY, JSON.stringify(snapshot));
    state.localRejoinSnapshot = snapshot;
  } catch (err) {
    showToast("Could not save local match.");
  }
}

function loadLocalRejoinSnapshot() {
  const raw = localStorage.getItem(LOCAL_REJOIN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!isValidLocalRejoinSnapshot(parsed)) {
      localStorage.removeItem(LOCAL_REJOIN_KEY);
      return null;
    }
    return parsed;
  } catch (err) {
    localStorage.removeItem(LOCAL_REJOIN_KEY);
    return null;
  }
}

function clearLocalRejoinSnapshot() {
  state.localRejoinSnapshot = null;
  localStorage.removeItem(LOCAL_REJOIN_KEY);
}

function hydrateLocalFromSnapshot(snapshot) {
  if (!isValidLocalRejoinSnapshot(snapshot)) {
    clearLocalRejoinSnapshot();
    updateLocalRejoinCard();
    showToast("Saved local match was invalid.");
    return;
  }
  state.mode = "local";
  state.room = snapshot.room;
  state.you = { playerId: snapshot.room.players.host.id, role: "local" };
  state.keepPickOpen = false;
  state.lastLeaderId = null;
  state.lastWinSignature = null;
  state.localHasSpun = Boolean(
    snapshot.localHasSpun ??
    snapshot.room.round?.hasPickedStarter ??
    snapshot.room.round?.firstPlayerId
  );
  stopShuffleStripLoop();
  state.localStrip = {
    ...createInitialLocalStripState(),
    activeIndex: Number.isFinite(snapshot.localShuffleIndex) ? snapshot.localShuffleIndex : 0,
    winnerId: snapshot.room.round?.firstPlayerId || snapshot.room.round?.pickerId || null
  };
  renderRoom();
  showScreen(resolveScreen(state.room), { history: "replace" });
}

function createLocalRoom(fruitOne, fruitTwo) {
  const host = {
    id: localId("player"),
    name: fruitOne.name,
    emoji: fruitOne.emoji,
    theme: fruitOne.theme,
    role: "host",
    score: 0,
    gamesWon: 0,
    ready: true,
    connected: true
  };
  const guest = {
    id: localId("player"),
    name: fruitTwo.name,
    emoji: fruitTwo.emoji,
    theme: fruitTwo.theme,
    role: "guest",
    score: 0,
    gamesWon: 0,
    ready: true,
    connected: true
  };

  return {
    code: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    players: {
      host,
      guest
    },
    round: {
      pickerId: null,
      firstPlayerId: null,
      shuffleAt: null,
      status: "waiting_game",
      hostGameId: null,
      guestGameId: null,
      resolvedGameId: null,
      hasPickedStarter: false
    },
    game: null,
    games: listLocalGames()
  };
}

function getLocalPlayers(room) {
  if (!room) return [];
  return [room.players.host, room.players.guest].filter(Boolean);
}

function getOtherLocalPlayerId(room, currentId) {
  const players = getLocalPlayers(room);
  if (players.length < 2) return null;
  const next = players.find((player) => player.id !== currentId);
  return next ? next.id : null;
}

function advanceLocalRoundByAlternation() {
  if (!state.room) return;
  const players = getLocalPlayers(state.room);
  if (players.length < 2) return;
  let next = null;
  if (state.localHasSpun) {
    const current = state.room.round?.firstPlayerId || state.room.round?.pickerId;
    next = current ? getOtherLocalPlayerId(state.room, current) : players[0].id;
  }
  state.room.round = {
    pickerId: next,
    firstPlayerId: next,
    shuffleAt: null,
    status: "waiting_game",
    hostGameId: null,
    guestGameId: null,
    resolvedGameId: null,
    hasPickedStarter: Boolean(state.localHasSpun)
  };
  state.localStrip.winnerId = next;
  state.room.game = null;
  state.room.updatedAt = Date.now();
  handleLocalUpdate();
}

function handleLocalUpdate() {
  saveLocalRejoinSnapshot(state.room);
  updateLocalRejoinCard();
  renderRoom();
  const endSignature = getEndSignature(state.room);
  if (endSignature && endSignature !== state.lastWinSignature) {
    state.lastWinSignature = endSignature;
    showScreen("winner", { history: "replace" });
    return;
  }
  showScreen(resolveScreen(state.room), { history: "replace" });
}

function orderPlayersByFirst(players, firstPlayerId) {
  if (!firstPlayerId) return players;
  const first = players.find((player) => player.id === firstPlayerId);
  if (!first) return players;
  return [first, ...players.filter((player) => player.id !== firstPlayerId)];
}

function startLocalGame(gameId) {
  const game = localGames[gameId];
  if (!game || !state.room) return;
  if (game.comingSoon || typeof game.init !== "function") {
    showToast("That game is coming soon.");
    return;
  }
  const players = [state.room.players.host, state.room.players.guest].filter(Boolean);
  const firstPlayerId = state.room.round?.firstPlayerId || players[0]?.id || null;
  const ordered = orderPlayersByFirst(players, firstPlayerId);
  state.room.game = {
    id: game.id,
    name: game.name,
    state: game.init(ordered)
  };
  if (state.room.round) {
    state.room.round.hostGameId = game.id;
    state.room.round.guestGameId = game.id;
    state.room.round.resolvedGameId = game.id;
    state.room.round.hasPickedStarter = true;
    state.room.round.status = "playing";
  }
  state.room.updatedAt = Date.now();
  handleLocalUpdate();
}

function startLocalRoundFromChoice(gameId) {
  if (!state.room) return;
  const game = localGames[gameId];
  if (!game || game.comingSoon) {
    showToast("That game is coming soon.");
    return;
  }
  if (!state.room.round) {
    state.room.round = {
      pickerId: null,
      firstPlayerId: null,
      shuffleAt: null,
      status: "waiting_game",
      hostGameId: null,
      guestGameId: null,
      resolvedGameId: null,
      hasPickedStarter: false
    };
  }

  state.room.round.hostGameId = gameId;
  state.room.round.guestGameId = gameId;
  state.room.round.resolvedGameId = gameId;

  if (!state.localHasSpun) {
    state.room.round.status = "shuffling";
    state.room.round.shuffleAt = Date.now();
    state.room.updatedAt = Date.now();
    handleLocalUpdate();
    return;
  }

  if (!state.room.round.firstPlayerId) {
    const players = getLocalPlayers(state.room);
    const first = players[0]?.id || null;
    state.room.round.firstPlayerId = first;
    state.room.round.pickerId = first;
  }
  startLocalGame(gameId);
}

function applyLocalMove(index) {
  if (!state.room?.game) return;
  const game = localGames[state.room.game.id];
  if (!game) return;
  const previousWinner = state.room.game.state.winnerId;
  const result = game.applyMove(state.room.game.state, { index }, state.room.game.state.nextPlayerId);
  if (result?.error) {
    showToast(result.error);
    return;
  }
  state.room.game.state = result.state;
  if (!previousWinner && result.state.winnerId) {
    const winner = playerById(state.room, result.state.winnerId);
    if (winner) {
      winner.gamesWon += 1;
      winner.score += 1;
    }
  }
  state.room.updatedAt = Date.now();
  handleLocalUpdate();
}

function displayEmoji(player) {
  if (!player) return "🙂";
  if (player.emoji) return player.emoji;
  const fruit = Object.values(FRUITS).find((entry) => entry.theme === player.theme);
  return fruit ? fruit.emoji : "🙂";
}

function leaveRoom(options = {}) {
  const historyMode = options.history || "push";
  stopShuffleStripLoop();
  if (isLocalMode()) {
    leaveLocalMatch({ saveForRejoin: false, history: historyMode });
    return;
  }

  if (state.room?.code) {
    setOnlineRejoinData(state.room.code, state.room.createdAt || Date.now());
  }
  updateRejoinCard();

  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify({ type: "leave_room" }));
  }

  state.room = null;
  state.you = null;
  state.autoJoinCode = null;
  document.body.removeAttribute("data-theme");
  showScreen("landing", { history: historyMode });
}

function leaveLocalMatch({ saveForRejoin, history = "push" } = {}) {
  if (!isLocalMode() || !state.room) {
    showScreen("landing", { history });
    return;
  }
  if (saveForRejoin) {
    saveLocalRejoinSnapshot(state.room);
  }
  state.mode = "online";
  state.room = null;
  state.you = null;
  state.lastLeaderId = null;
  state.lastWinSignature = null;
  state.localHasSpun = false;
  stopShuffleStripLoop();
  state.localStrip = createInitialLocalStripState();
  document.body.removeAttribute("data-theme");
  updateLocalRejoinCard();
  showScreen("landing", { history });
}

function renderRoom() {
  const room = state.room;
  if (!room) return;

  const me = playerById(room, state.you?.playerId);
  if (me?.theme) {
    document.body.dataset.theme = me.theme;
  } else {
    document.body.removeAttribute("data-theme");
  }

  const heroRoom = document.getElementById("hero-room");
  if (heroRoom) {
    heroRoom.classList.toggle("hidden", !shouldShowHeroRoomCode());
  }
  const codeEl = document.getElementById("room-code");
  if (codeEl) codeEl.textContent = room.code;

  const previousLeader = state.lastLeaderId;
  const leaderId = getLeaderId([room.players.host, room.players.guest]);

  renderLobby(room);
  renderShuffle(room);
  renderScoreboard(room, leaderId);
  renderWinner(room, leaderId, previousLeader);
  renderPickScreen(room);
  renderWaitScreen(room);
  renderGame(room);
  renderGameList(room);
  renderTicTacToe(room);
  renderEndRequest(room);

  state.lastLeaderId = leaderId;
}

function renderLobby(room) {
  const cta = document.getElementById("ready-cta");
  const endGameButton = document.getElementById("end-game");
  if (!cta) return;
  if (!room.players.guest) {
    cta.disabled = true;
    cta.textContent = "Waiting for second player";
    cta.classList.add("is-waiting-copy");
    cta.dataset.action = "none";
    if (endGameButton) endGameButton.classList.add("hidden");
    return;
  }
  cta.classList.remove("is-waiting-copy");

  const gameActive = Boolean(room.game && !room.game.state?.winnerId && !room.game.state?.draw);

  if (isLocalMode()) {
    if (endGameButton) endGameButton.classList.add("hidden");
    if (gameActive) {
      cta.disabled = true;
      cta.textContent = "Finish current game";
      cta.classList.remove("is-waiting-copy");
      cta.dataset.action = "none";
      return;
    }
    cta.disabled = false;
    cta.textContent = "Pick a game";
    cta.classList.remove("is-waiting-copy");
    cta.dataset.action = "pick";
    return;
  }

  if (endGameButton) {
    if (!isLocalMode() && gameActive) {
      endGameButton.classList.remove("hidden");
      endGameButton.disabled = Boolean(room.endRequest);
    } else {
      endGameButton.classList.add("hidden");
    }
  }

  if (state.you?.role !== "host" && state.you?.role !== "guest") {
    cta.disabled = true;
    cta.textContent = "Waiting for players...";
    cta.classList.remove("is-waiting-copy");
    cta.dataset.action = "none";
    return;
  }

  cta.disabled = false;
  cta.textContent = "Pick a game";
  cta.classList.remove("is-waiting-copy");
  cta.dataset.action = "pick";
}

function renderScoreboard(room, leaderId) {
  const columns = document.getElementById("score-columns");
  if (!columns) return;
  columns.innerHTML = "";

  const host = room.players.host;
  const guest = room.players.guest;
  const isWaitingForGuest = !guest;

  columns.appendChild(buildScoreColumn(host, "Host", leaderId));
  columns.appendChild(buildScoreColumn(guest, "Guest", leaderId, { isWaiting: isWaitingForGuest }));
}

function buildScoreColumn(player, label, leaderId, options = {}) {
  const isWaiting = Boolean(options.isWaiting);
  const column = document.createElement("div");
  column.className = "score-column";
  if (label === "Guest") {
    column.classList.add("score-column-guest");
  }
  if (isWaiting) {
    column.classList.add("score-column-waiting");
  }
  const theme = player?.theme || (label === "Host" ? "strawberry" : "kiwi");
  column.classList.add(`theme-${theme}`);
  const showLeaderCrown = Boolean(
    player && leaderId && player.id === leaderId && (player.gamesWon ?? 0) > 0
  );
  if (showLeaderCrown) {
    column.classList.add("leader");
  }
  const top = document.createElement("div");
  top.className = "score-top";

  const emoji = document.createElement("div");
  emoji.className = "score-emoji";
  if (isWaiting) {
    emoji.classList.add("score-emoji-waiting");
  }

  const avatarInner = document.createElement("span");
  avatarInner.className = "score-emoji-inner";

  const avatarArt = document.createElement("span");
  avatarArt.className = "score-emoji-art";

  if (isWaiting) {
    avatarArt.classList.add("score-emoji-art-placeholder");
  } else {
    const avatarImage = document.createElement("img");
    avatarImage.src = "/src/assets/player.svg";
    avatarImage.alt = "";
    avatarArt.appendChild(avatarImage);
  }
  avatarInner.appendChild(avatarArt);
  emoji.appendChild(avatarInner);

  if (isWaiting) {
    const spinner = document.createElement("span");
    spinner.className = "score-avatar-spinner";
    spinner.setAttribute("aria-hidden", "true");
    emoji.appendChild(spinner);
  }

  if (showLeaderCrown) {
    const crown = document.createElement("span");
    crown.className = "score-crown";
    crown.textContent = "👑";
    emoji.appendChild(crown);
  }

  const info = document.createElement("div");
  const name = document.createElement("div");
  name.className = "score-name";
  if (isWaiting) {
    name.classList.add("score-skeleton-name");
    name.setAttribute("aria-label", `${label} waiting`);
    const nameSkeleton = document.createElement("span");
    nameSkeleton.className = "skeleton-name-bar";
    nameSkeleton.setAttribute("aria-hidden", "true");
    name.appendChild(nameSkeleton);
  } else {
    name.textContent = player ? player.name : `${label} (waiting)`;
  }
  const role = document.createElement("div");
  role.className = "score-role";
  role.textContent = label;
  info.appendChild(name);
  info.appendChild(role);

  top.appendChild(emoji);
  top.appendChild(info);

  const stats = document.createElement("div");
  stats.className = "score-stats";

  stats.appendChild(buildStatRow("Games won", player ? player.gamesWon : "--", { isWaiting }));

  column.appendChild(top);
  column.appendChild(stats);

  return column;
}

function buildStatRow(label, value, options = {}) {
  const isWaiting = Boolean(options.isWaiting);
  const row = document.createElement("div");
  row.className = "stat-row";
  if (isWaiting) {
    row.classList.add("stat-row-waiting");
  }

  const labelEl = document.createElement("div");
  labelEl.className = "stat-label";
  labelEl.textContent = label;

  const valueEl = document.createElement("div");
  valueEl.className = "stat-value";
  if (isWaiting) {
    valueEl.classList.add("stat-value-waiting");
    const valueSkeleton = document.createElement("span");
    valueSkeleton.className = "skeleton-value-bar";
    valueSkeleton.setAttribute("aria-hidden", "true");
    valueEl.appendChild(valueSkeleton);
  } else {
    valueEl.textContent = value;
  }

  row.appendChild(labelEl);
  row.appendChild(valueEl);
  return row;
}

function renderGameList(room) {
  const list = document.getElementById("game-list");
  const statusEl = document.getElementById("pick-status");
  list.innerHTML = "";

  const finished = Boolean(room.game?.state?.winnerId || room.game?.state?.draw);
  const gameActive = Boolean(room.game && !finished);
  const isPlayer = isLocalMode() || state.you?.role === "host" || state.you?.role === "guest";
  const canPick = Boolean(isPlayer && room.players.host && room.players.guest && !gameActive && room.round?.status !== "shuffling");
  const hostChoiceId = room.round?.hostGameId || null;
  const guestChoiceId = room.round?.guestGameId || null;
  const resolvedGameId = room.round?.resolvedGameId || null;
  const myChoiceId = !isLocalMode()
    ? (state.you?.role === "host" ? hostChoiceId : guestChoiceId)
    : resolvedGameId;
  const otherChoiceId = !isLocalMode()
    ? (state.you?.role === "host" ? guestChoiceId : hostChoiceId)
    : null;
  const picksMatch = Boolean(hostChoiceId && guestChoiceId && hostChoiceId === guestChoiceId);
  const picksMismatch = Boolean(hostChoiceId && guestChoiceId && hostChoiceId !== guestChoiceId);
  const waitingForOther = Boolean(!isLocalMode() && myChoiceId && !otherChoiceId && !resolvedGameId);

  if (statusEl) {
    if (isLocalMode()) {
      statusEl.textContent = "";
      statusEl.classList.add("hidden");
    } else if (waitingForOther) {
      statusEl.textContent = "Waiting for other player...";
      statusEl.classList.remove("hidden");
    } else if (picksMismatch && resolvedGameId) {
      statusEl.textContent = "Different picks — host choice selected";
      statusEl.classList.remove("hidden");
    } else if (picksMatch && resolvedGameId) {
      statusEl.textContent = "Both picked the same game";
      statusEl.classList.remove("hidden");
    } else {
      statusEl.textContent = "";
      statusEl.classList.add("hidden");
    }
  }
  const sortedGames = [...(room.games || [])].sort((a, b) => {
    const aSoon = Boolean(a.comingSoon);
    const bSoon = Boolean(b.comingSoon);
    if (aSoon === bSoon) return 0;
    return aSoon ? 1 : -1;
  });

  sortedGames.forEach((game) => {
    const comingSoon = Boolean(game.comingSoon);
    const card = document.createElement("article");
    card.className = "game-card";
    if (comingSoon) {
      card.classList.add("coming-soon");
    }
    if (room.game?.id === game.id || myChoiceId === game.id || room.round?.resolvedGameId === game.id) {
      card.classList.add("active");
    }
    const canPlayThis = canPick && !comingSoon;
    card.setAttribute("aria-label", comingSoon ? `${game.name}, coming soon` : game.name);

    const banner = document.createElement("div");
    banner.className = `game-banner ${getGameBannerClass(game)}`;

    const bannerLabel = document.createElement("div");
    bannerLabel.className = "game-banner-label";
    bannerLabel.textContent = getGameBannerLabel(game);
    banner.appendChild(bannerLabel);

    const meta = document.createElement("div");
    meta.className = "game-meta";

    const titleRow = document.createElement("div");
    titleRow.className = "game-name-row";

    const name = document.createElement("h3");
    name.className = "game-name";
    name.textContent = game.name;
    titleRow.appendChild(name);

    if (comingSoon) {
      const tag = document.createElement("span");
      tag.className = "game-chip";
      tag.textContent = "Coming soon";
      titleRow.appendChild(tag);
    } else if (!isLocalMode() && myChoiceId === game.id) {
      const tag = document.createElement("span");
      tag.className = "game-chip choice-chip";
      tag.textContent = "Your choice";
      titleRow.appendChild(tag);
    }

    const ctaRow = document.createElement("div");
    ctaRow.className = "game-cta-row";

    const cta = document.createElement("button");
    cta.type = "button";
    cta.className = "game-cta";
    cta.textContent = "Play";
    cta.disabled = !canPlayThis;
    cta.setAttribute("aria-label", comingSoon ? `${game.name} coming soon` : `Play ${game.name}`);

    ctaRow.appendChild(cta);
    meta.appendChild(titleRow);
    meta.appendChild(ctaRow);
    card.appendChild(banner);
    card.appendChild(meta);

    cta.addEventListener("click", () => {
      if (comingSoon) return;
      state.keepPickOpen = false;
      if (isLocalMode()) {
        startLocalRoundFromChoice(game.id);
        return;
      }
      send({ type: "select_game", gameId: game.id });
    });
    list.appendChild(card);
  });

  const newRound = document.getElementById("new-round");
  if (isLocalMode()) {
    newRound.classList.add("hidden");
  } else if (finished && isPlayer) {
    newRound.classList.remove("hidden");
  } else {
    newRound.classList.add("hidden");
  }
}

function renderTicTacToe(room) {
  const boardEl = document.getElementById("ttt-board");
  const indicatorEl = document.getElementById("turn-indicator");
  const isLocal = isLocalMode();
  const host = room.players?.host || null;
  const guest = room.players?.guest || null;

  const renderTurnSplit = (activePlayerId = null, mode = "turn") => {
    if (!indicatorEl) return;
    indicatorEl.innerHTML = "";
    indicatorEl.classList.remove("turn-passive");
    if (!activePlayerId) {
      indicatorEl.classList.add("turn-passive");
    }

    const sides = [
      { player: host, side: "host", fallback: "Player 1" },
      { player: guest, side: "guest", fallback: "Player 2" }
    ];

    sides.forEach(({ player, side, fallback }) => {
      const pane = document.createElement("div");
      pane.className = `turn-player turn-player-${side}`;

      const theme = player?.theme || (side === "host" ? "strawberry" : "kiwi");
      pane.classList.add(`theme-${theme}`);

      const isActive = Boolean(activePlayerId && player && player.id === activePlayerId);
      pane.classList.add(isActive ? "is-active" : "is-inactive");
      if (!player) pane.classList.add("is-empty");

      const avatar = document.createElement("span");
      avatar.className = "turn-player-avatar";
      const avatarImg = document.createElement("img");
      avatarImg.src = "/src/assets/player.svg";
      avatarImg.alt = "";
      avatar.setAttribute("aria-hidden", "true");
      avatar.appendChild(avatarImg);

      const meta = document.createElement("span");
      meta.className = "turn-player-meta";
      const name = document.createElement("span");
      name.className = "turn-player-name";
      name.textContent = player?.name || fallback;
      const stateLabel = document.createElement("span");
      stateLabel.className = "turn-player-state";
      if (mode === "winner") {
        stateLabel.textContent = isActive ? "Won" : "Done";
      } else if (mode === "draw") {
        stateLabel.textContent = "Draw";
      } else if (!player) {
        stateLabel.textContent = "Waiting";
      } else {
        stateLabel.textContent = isActive ? "Turn" : "Waiting";
      }
      meta.appendChild(name);
      meta.appendChild(stateLabel);

      pane.appendChild(avatar);
      pane.appendChild(meta);
      indicatorEl.appendChild(pane);
    });
  };

  if (!room.game || room.game.id !== "tic_tac_toe") {
    boardEl.innerHTML = "";
    renderTurnSplit(null, "idle");
    return;
  }

  const stateGame = room.game.state;
  const winner = stateGame.winnerId ? playerById(room, stateGame.winnerId) : null;
  const symbolOwners = new Map();
  Object.entries(stateGame.symbols || {}).forEach(([playerId, symbol]) => {
    const owner = playerById(room, playerId);
    if (owner && symbol) {
      symbolOwners.set(symbol, owner);
    }
  });

  if (winner) {
    renderTurnSplit(winner.id, "winner");
  } else if (stateGame.draw) {
    renderTurnSplit(null, "draw");
  } else {
    renderTurnSplit(stateGame.nextPlayerId || null, "turn");
  }

  boardEl.innerHTML = "";
  stateGame.board.forEach((cell, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ttt-cell";
    if (cell) {
      const owner = symbolOwners.get(cell);
      const mark = document.createElement("span");
      mark.className = `ttt-mark ${cell === "X" ? "ttt-mark-x" : "ttt-mark-o"}`;
      if (owner?.theme) {
        mark.classList.add(`theme-${owner.theme}`);
      }
      if (cell === "X") {
        mark.innerHTML = "<span></span><span></span>";
      } else {
        mark.innerHTML = "<span></span>";
      }
      button.appendChild(mark);
    }

    const isPlayable = !cell && !stateGame.winnerId && !stateGame.draw;
    const isYourTurn = isLocal ? Boolean(stateGame.nextPlayerId) : stateGame.nextPlayerId === state.you?.playerId;
    const isPlayer = isLocal || state.you?.role === "host" || state.you?.role === "guest";
    button.disabled = !(isPlayable && isYourTurn && isPlayer);

    button.addEventListener("click", () => {
      if (isLocal) {
        applyLocalMove(index);
        return;
      }
      send({ type: "move", gameId: "tic_tac_toe", move: { index } });
    });

    boardEl.appendChild(button);
  });
}

function renderPickScreen(room) {
  renderPickHint({
    room,
    state,
    isLocalMode,
    getGameName
  });
}

function renderWaitScreen(room) {
  const emojiEl = document.getElementById("wait-emoji");
  const nameEl = document.getElementById("wait-name");
  const textEl = document.getElementById("wait-text");
  const picker = playerById(room, room.round?.firstPlayerId || room.round?.pickerId);

  if (!picker) {
    if (emojiEl) emojiEl.textContent = "🎲";
    if (nameEl) nameEl.textContent = "Waiting";
    if (textEl) textEl.textContent = "for game choices to resolve.";
    return;
  }

  if (emojiEl) emojiEl.textContent = displayEmoji(picker);
  if (nameEl) nameEl.textContent = picker.name;
  if (textEl) textEl.textContent = "starts this round.";
}

function renderGame(room) {
  const title = document.getElementById("game-title");
  if (title) title.textContent = room.game?.name || "";

  const endButton = document.getElementById("end-game-game");
  if (endButton) {
    const gameActive = Boolean(room.game && !room.game.state?.winnerId && !room.game.state?.draw);
    if (!isLocalMode() && gameActive) {
      endButton.classList.remove("hidden");
      endButton.disabled = Boolean(room.endRequest);
    } else {
      endButton.classList.add("hidden");
    }
  }
}

function renderWinner(room, leaderId, previousLeader) {
  const winnerId = room.game?.state?.winnerId;
  const isDraw = Boolean(room.game?.state?.draw);
  if (!winnerId && !isDraw) return;
  const winner = winnerId ? playerById(room, winnerId) : null;

  const emojiEl = document.getElementById("winner-emoji");
  const titleEl = document.getElementById("winner-title");
  const columns = document.getElementById("winner-score-columns");

  if (emojiEl) emojiEl.textContent = isDraw ? "🤝" : displayEmoji(winner);
  if (titleEl) {
    titleEl.textContent = isDraw && !winner
      ? "It's a draw"
      : `${winner?.name ?? "Someone"} is the winner`;
  }
  if (columns) {
    columns.innerHTML = "";
    columns.appendChild(buildScoreColumn(room.players.host, "Host", leaderId));
    columns.appendChild(buildScoreColumn(room.players.guest, "Guest", leaderId));
  }
}

function getEndSignature(room) {
  const stateGame = room.game?.state;
  if (!stateGame) return null;
  if (stateGame.draw) return `${room.code}:draw:${stateGame.history?.length || 0}`;
  if (!stateGame.winnerId) return null;
  const winner = playerById(room, stateGame.winnerId);
  if (!winner) return null;
  return `${room.code}:${stateGame.winnerId}:${winner.gamesWon}`;
}

function renderEndRequest(room) {
  const activeGame = room.game && !room.game.state?.winnerId && !room.game.state?.draw;
  if (!activeGame || !room.endRequest) {
    hideActionToast();
    return;
  }

  const requester = playerById(room, room.endRequest.byId);
  const requesterName = requester ? requester.name : "Someone";
  const isRequester = requester?.id === state.you?.playerId;

  if (isRequester) {
    showActionToast("End request sent.", "Waiting...", () => {});
    if (actionToastCta) actionToastCta.disabled = true;
    return;
  }

  if (actionToastCta) actionToastCta.disabled = false;
  showActionToast(`${requesterName} wants to end. Do you agree?`, "End game", () => {
    send({ type: "end_game_agree" });
  });
}

function renderShuffle(room) {
  const stage = document.getElementById("shuffle-strip-stage");
  const grid = document.getElementById("shuffle-grid");
  const spinButton = document.getElementById("shuffle-spin");
  const result = document.getElementById("shuffle-result");
  if (!stage || !grid || !spinButton || !result) return;

  renderShuffleGrid(room);
  paintShuffleSelection();

  const picker = playerById(room, room.round?.pickerId || room.round?.firstPlayerId);
  if (state.localStrip.isAnimating || state.localStrip.isSettling) {
    result.textContent = "Spinning...";
    result.classList.add("show");
  } else if (room.round?.status === "shuffling") {
    if (state.localHasSpun && picker) {
      result.textContent = `${picker.name} starts`;
      result.classList.add("show");
    } else {
      result.textContent = "";
      result.classList.remove("show");
    }
  } else if (picker && room.round?.status === "playing") {
    result.textContent = `${picker.name} starts`;
    result.classList.add("show");
  } else {
    result.textContent = "";
    result.classList.remove("show");
  }

  const localCanSpin = room.round?.status === "shuffling" && !state.localHasSpun && Boolean(room.round?.resolvedGameId);
  const onlineCanSpin = room.round?.status === "shuffling" && Boolean(room.round?.resolvedGameId);
  const canSpin = isLocalMode() ? localCanSpin : onlineCanSpin;
  const shouldShow = canSpin || state.localStrip.isAnimating || state.localStrip.isSettling;
  spinButton.classList.toggle("hidden", !shouldShow);
  spinButton.disabled = state.localStrip.isAnimating || state.localStrip.isSettling || !canSpin;
  const spinLabel = spinButton.querySelector(".wheel-spin-label");
  if (spinLabel) {
    spinLabel.textContent = "Spin";
  }

  if (!isLocalMode() && room.round?.status === "playing" && state.localStrip.isAnimating && !state.localStrip.isSettling) {
    const winnerId = room.round?.pickerId || room.round?.firstPlayerId;
    if (winnerId) beginShuffleSettle({ room, winnerId });
  }
}

function paintShuffleSelection() {
  const grid = document.getElementById("shuffle-grid");
  if (!grid) return;
  const cards = Array.from(grid.querySelectorAll(".shuffle-card"));
  cards.forEach((card, index) => {
    const isActive = index === state.localStrip.activeIndex;
    const isFinal = state.localStrip.finalIndex === index && !state.localStrip.isAnimating && !state.localStrip.isSettling;
    card.classList.toggle("is-active", isActive);
    card.classList.toggle("is-final", isFinal);
  });
}

function renderShuffleGrid(room) {
  const grid = document.getElementById("shuffle-grid");
  if (!grid) return;
  const players = getLocalPlayers(room);
  if (players.length < 2) {
    grid.innerHTML = "";
    grid.dataset.signature = "";
    return;
  }

  const signature = players.map((player) => `${player.id}:${player.theme || "none"}`).join("|");
  if (grid.dataset.signature === signature) return;
  grid.dataset.signature = signature;
  grid.innerHTML = "";

  const assignment = [players[0], players[1], players[1], players[0]];
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 4; i += 1) {
    const player = assignment[i];
    const card = document.createElement("div");
    card.className = `shuffle-card ${i === 0 || i === 3 ? "player-a" : "player-b"}${i === 1 || i === 3 ? " is-right" : ""}`;
    card.dataset.cardIndex = String(i);
    card.dataset.playerId = player.id;
    card.setAttribute("aria-hidden", "true");

    const avatar = document.createElement("img");
    avatar.className = "shuffle-card-avatar";
    avatar.src = "/src/assets/player.svg";
    avatar.alt = "";
    avatar.setAttribute("aria-hidden", "true");
    card.appendChild(avatar);

    fragment.appendChild(card);
  }
  grid.appendChild(fragment);
}

function stopShuffleStripLoop() {
  clearShuffleStepTimer();
  clearShuffleAutoStopTimer();
  state.localStrip.isAnimating = false;
  state.localStrip.isSettling = false;
}

function clearShuffleAutoStopTimer() {
  if (state.localStrip.autoStopTimer) {
    clearTimeout(state.localStrip.autoStopTimer);
    state.localStrip.autoStopTimer = null;
  }
}

function clearShuffleStepTimer() {
  if (state.localStrip.stepTimer) {
    clearTimeout(state.localStrip.stepTimer);
    state.localStrip.stepTimer = null;
  }
}

function nextClockwiseIndex(index) {
  const at = SHUFFLE_CLOCKWISE_ORDER.indexOf(index);
  if (at < 0) return SHUFFLE_CLOCKWISE_ORDER[0];
  return SHUFFLE_CLOCKWISE_ORDER[(at + 1) % SHUFFLE_CLOCKWISE_ORDER.length];
}

function clockwiseDistance(from, to) {
  const start = SHUFFLE_CLOCKWISE_ORDER.indexOf(from);
  const end = SHUFFLE_CLOCKWISE_ORDER.indexOf(to);
  if (start < 0 || end < 0) return 0;
  if (end >= start) return end - start;
  return SHUFFLE_CLOCKWISE_ORDER.length - start + end;
}

function runShuffleStepLoop(intervalMs = SHUFFLE_STEP_MS) {
  clearShuffleStepTimer();
  if (!state.localStrip.isAnimating || state.localStrip.isSettling) return;
  state.localStrip.stepTimer = setTimeout(() => {
    state.localStrip.activeIndex = nextClockwiseIndex(state.localStrip.activeIndex);
    paintShuffleSelection();
    runShuffleStepLoop(intervalMs);
  }, intervalMs);
}

function beginShuffleSpin(room) {
  state.localStrip.isAnimating = true;
  state.localStrip.isSettling = false;
  state.localStrip.finalIndex = null;
  state.localStrip.winnerId = null;
  clearShuffleStepTimer();
  clearShuffleAutoStopTimer();
  runShuffleStepLoop();
  scheduleShuffleAutoStop(room);
}

function pickFinalIndexForWinner(room, winnerId) {
  const players = getLocalPlayers(room);
  if (players.length < 2 || !winnerId) return null;
  const forA = winnerId === players[0].id;
  const choices = forA ? [0, 3] : [1, 2];
  return choices[Math.floor(Math.random() * choices.length)];
}

function finalizeShuffleSelection({ room, winnerId, finalIndex }) {
  clearShuffleStepTimer();
  clearShuffleAutoStopTimer();

  state.localStrip.isAnimating = false;
  state.localStrip.isSettling = false;
  state.localStrip.winnerId = winnerId;
  state.localStrip.finalIndex = finalIndex;
  state.localStrip.activeIndex = finalIndex;
  paintShuffleSelection();

  if (isLocalMode()) {
    state.localHasSpun = true;
    state.room.round.pickerId = winnerId;
    state.room.round.firstPlayerId = winnerId;
    state.room.round.hasPickedStarter = true;
    state.room.round.status = "shuffling";
    state.room.round.shuffleAt = Date.now();
    state.room.updatedAt = Date.now();
    renderRoom();
    const chosenGameId = state.room.round.resolvedGameId;
    clearTimeout(state.shuffleTimer);
    state.shuffleTimer = setTimeout(() => {
      if (!chosenGameId || state.activeScreen !== "shuffle") return;
      startLocalGame(chosenGameId);
    }, 1200);
    return;
  }

  renderRoom();
}

function resolveStopWinner(room) {
  if (isLocalMode()) {
    const players = getLocalPlayers(room);
    if (players.length < 2) return null;
    const winner = Math.random() < 0.5 ? players[0] : players[1];
    return winner.id;
  }
  return room.round?.pickerId || room.round?.firstPlayerId || null;
}

function beginShuffleSettle({ room, winnerId }) {
  if (!winnerId || !state.localStrip.isAnimating || state.localStrip.isSettling) return;
  state.localStrip.isSettling = true;
  state.localStrip.winnerId = winnerId;
  clearShuffleAutoStopTimer();
  clearShuffleStepTimer();

  const finalIndex = pickFinalIndexForWinner(room, winnerId);
  if (finalIndex == null) {
    stopShuffleStripLoop();
    return;
  }
  state.localStrip.finalIndex = finalIndex;

  const distance = clockwiseDistance(state.localStrip.activeIndex, finalIndex);
  const extraSteps = SHUFFLE_SETTLE_MIN_STEPS + Math.floor(Math.random() * 5);
  const totalSteps = distance + extraSteps;

  const step = (stepIndex, delay) => {
    if (stepIndex >= totalSteps) {
      finalizeShuffleSelection({ room, winnerId, finalIndex });
      return;
    }
    state.localStrip.stepTimer = setTimeout(() => {
      state.localStrip.activeIndex = nextClockwiseIndex(state.localStrip.activeIndex);
      paintShuffleSelection();
      step(stepIndex + 1, Math.min(delay + 22, 260));
    }, delay);
  };
  step(0, 112);
}

function scheduleShuffleAutoStop(room, attempt = 0) {
  clearShuffleAutoStopTimer();
  state.localStrip.autoStopTimer = setTimeout(() => {
    state.localStrip.autoStopTimer = null;
    if (!state.room || state.room !== room || state.localStrip.isSettling || !state.localStrip.isAnimating) return;

    const winnerId = resolveStopWinner(room);
    if (winnerId) {
      beginShuffleSettle({ room, winnerId });
      return;
    }

    if (attempt < 3) {
      scheduleShuffleAutoStop(room, attempt + 1);
      return;
    }

    stopShuffleStripLoop();
    showToast("Couldn't pick a starter. Try again.");
    renderRoom();
  }, attempt === 0 ? SHUFFLE_AUTO_STOP_MS : 240);
}

function startWheelSpin() {
  if (!state.room) return;
  const stage = document.getElementById("shuffle-strip-stage");
  if (!stage) return;
  const players = getLocalPlayers(state.room);
  if (players.length < 2) return;
  const canSpin = state.room.round?.status === "shuffling" && Boolean(state.room.round?.resolvedGameId);
  if (!canSpin || state.localStrip.isAnimating || state.localStrip.isSettling) return;
  if (isLocalMode() && state.localHasSpun) return;

  renderShuffleGrid(state.room);
  beginShuffleSpin(state.room);
  renderRoom();
}

function resolveScreen(room) {
  const finished = room.game?.state?.winnerId || room.game?.state?.draw;
  if (isLocalMode()) {
    if (finished) return "winner";
    if (room.round?.status === "shuffling") return "shuffle";
    if (room.game && !finished) return "game";
    if (room.round?.status === "waiting_game") return "lobby";
    return "lobby";
  }
  const preferred = getPreferredRoomScreen(room?.code);
  if (room.round?.status === "shuffling") return "shuffle";
  if (room.game && !finished) return "game";
  if (finished) {
    const endSignature = getEndSignature(room);
    const dismissedSignature = getDismissedWinnerSignature(room?.code);
    if (endSignature && dismissedSignature === endSignature) {
      return preferred;
    }
    return "winner";
  }
  if (room.players.host && room.players.guest && !room.game) return preferred;
  return "lobby";
}

function setup() {
  const joinCodeInput = document.getElementById("join-code");
  const hostPicker = document.getElementById("host-fruit-picker");
  const joinPicker = document.getElementById("join-fruit-picker");
  const localPickerGrid = document.getElementById("local-fruit-grid");
  const localResumeButton = document.getElementById("local-rejoin-room");
  const localClearButton = document.getElementById("local-clear-rejoin");

  initModeToggle();
  initSettingsModal();
  registerServiceWorker();
  initInstallPromptHandling();
  state.localRejoinSnapshot = loadLocalRejoinSnapshot();

  const updateHostPicker = () => updateFruitPicker(hostPicker, state.hostFruit);
  const updateJoinPicker = () => updateFruitPicker(joinPicker, state.joinFruit);
  const updateLocalPickers = () => renderLocalSetup();

  setupFruitPicker(hostPicker, (fruitId) => {
    state.hostFruit = fruitId;
    updateHostPicker();
  });
  setupFruitPicker(joinPicker, (fruitId) => {
    state.joinFruit = fruitId;
    if (state.joinStep === "fruit") {
      renderJoinSetup();
    } else {
      updateJoinPicker();
    }
  });
  setupFruitPicker(localPickerGrid, (fruitId) => {
    if (state.localStep === "p1") {
      state.localFruits.one = fruitId;
      if (state.localFruits.two === fruitId) {
        state.localFruits.two = null;
      }
      state.localStep = "p2";
      updateLocalPickers();
      return;
    }

    state.localFruits.two = fruitId;
    updateLocalPickers();
    const fruitOne = getFruit(state.localFruits.one);
    const fruitTwo = getFruit(state.localFruits.two);
    if (!fruitOne || !fruitTwo) {
      showToast("Pick two fruits first.");
      return;
    }
    state.mode = "local";
    state.room = createLocalRoom(fruitOne, fruitTwo);
    state.you = { playerId: state.room.players.host.id, role: "local" };
    state.lastWinSignature = null;
    state.lastLeaderId = null;
    state.localHasSpun = false;
    stopShuffleStripLoop();
    state.localStrip = createInitialLocalStripState();
    state.localStep = "p1";
    saveLocalRejoinSnapshot(state.room);
    updateLocalRejoinCard();
    renderRoom();
    showScreen("lobby", { history: "push" });
  });
  updateHostPicker();
  updateJoinPicker();
  updateLocalPickers();
  renderJoinSetup();
  setLandingMode("local", { animate: false });

  if (landingTabLocal) {
    landingTabLocal.addEventListener("click", () => setLandingMode("local"));
  }
  if (landingTabOnline) {
    landingTabOnline.addEventListener("click", () => setLandingMode("online"));
  }

  document.getElementById("go-local").addEventListener("click", () => {
    state.mode = "local";
    state.localStep = "p1";
    state.localFruits = { one: null, two: null };
    state.localHasSpun = false;
    stopShuffleStripLoop();
    state.localStrip = createInitialLocalStripState();
    updateLocalPickers();
    showScreen("local", { history: "push" });
  });
  document.getElementById("go-host").addEventListener("click", () => {
    state.mode = "online";
    showScreen("host", { history: "push" });
  });
  document.getElementById("go-join").addEventListener("click", () => {
    state.mode = "online";
    resetJoinFlow();
    renderJoinSetup();
    showScreen("join", { history: "push" });
  });
  document.getElementById("create-room").addEventListener("click", () => {
    state.mode = "online";
    const fruit = getFruit(state.hostFruit);
    if (!fruit) {
      showToast("Pick a fruit first.");
      return;
    }
    send({
      type: "create_room",
      fruit: fruit.id,
      clientId: state.clientId
    });
  });

  document.getElementById("join-room").addEventListener("click", () => {
    state.mode = "online";
    const codeInput = document.getElementById("join-code");
    const code = codeInput ? codeInput.value.trim().toUpperCase() : "";
    if (state.joinStep === "code") {
      if (!code || code.length !== 4) {
        showToast("Enter a 4-letter room code.");
        return;
      }
      state.joinValidating = true;
      state.joinValidatedCode = code;
      renderJoinSetup();
      send({
        type: "validate_room",
        code,
        clientId: state.clientId,
        seatToken: state.seatToken
      });
      return;
    }

    const fruit = getFruit(state.joinFruit);
    if (!fruit) {
      showToast("Pick a fruit first.");
      return;
    }
    send({
      type: "join_room",
      code: state.joinValidatedCode || code,
      fruit: fruit.id,
      clientId: state.clientId,
      seatToken: state.seatToken
    });
  });

  if (joinCodeInput) {
    joinCodeInput.addEventListener("input", (event) => {
      event.target.value = event.target.value.toUpperCase();
    });
  }

  document.getElementById("new-round").addEventListener("click", () => {
    if (isLocalMode()) {
      advanceLocalRoundByAlternation();
      return;
    }
    send({ type: "new_round" });
  });

  const endGameButton = document.getElementById("end-game");
  if (endGameButton) {
    endGameButton.addEventListener("click", () => {
      if (!state.room || !state.room.game) return;
      if (isLocalMode()) {
        advanceLocalRoundByAlternation();
        return;
      }
      send({ type: "end_game_request" });
    });
  }

  const endGameGame = document.getElementById("end-game-game");
  if (endGameGame) {
    endGameGame.addEventListener("click", () => {
      if (!state.room || !state.room.game) return;
      if (isLocalMode()) {
        advanceLocalRoundByAlternation();
        return;
      }
      send({ type: "end_game_request" });
    });
  }

  const winnerAgain = document.getElementById("winner-play-again");
  if (winnerAgain) {
    winnerAgain.addEventListener("click", () => {
      state.keepPickOpen = true;
      if (isLocalMode()) {
        advanceLocalRoundByAlternation();
        showScreen("pick", { history: "push" });
        return;
      }
      if (state.room?.code) {
        setPreferredRoomScreen(state.room.code, "pick");
        clearDismissedWinnerSignature(state.room.code);
      }
      send({ type: "new_round" });
    });
  }

  const winnerHome = document.getElementById("winner-home");
  if (winnerHome) {
    winnerHome.addEventListener("click", () => {
      state.keepPickOpen = false;
      if (!isLocalMode() && state.room?.code) {
        setPreferredRoomScreen(state.room.code, "lobby");
        setDismissedWinnerSignature(state.room.code, getEndSignature(state.room));
      }
      showScreen("lobby", { history: "push" });
    });
  }

  const readyCta = document.getElementById("ready-cta");
  if (readyCta) {
    readyCta.addEventListener("click", () => {
      if (!state.room) return;
      const action = readyCta.dataset.action;
      if (action !== "pick") return;
      state.keepPickOpen = true;
      if (!isLocalMode() && state.room?.code) {
        setPreferredRoomScreen(state.room.code, "pick");
      }
      showScreen("pick", { history: "push" });
    });
  }

  document.getElementById("rejoin-room").addEventListener("click", () => {
    if (!state.lastRoomCode) return;
    state.mode = "online";
    state.autoJoinCode = state.lastRoomCode;
    send({
      type: "join_room",
      code: state.lastRoomCode,
      clientId: state.clientId,
      seatToken: state.seatToken
    });
  });

  const spinButton = document.getElementById("shuffle-spin");
  if (spinButton) {
    spinButton.addEventListener("click", () => startWheelSpin());
  }

  document.getElementById("clear-rejoin").addEventListener("click", () => {
    clearOnlineRejoinData();
    updateRejoinCard();
  });

  if (localResumeButton) {
    localResumeButton.addEventListener("click", () => {
      const snapshot = loadLocalRejoinSnapshot();
      if (!snapshot) {
        clearLocalRejoinSnapshot();
        updateLocalRejoinCard();
        showToast("No local match to resume.");
        return;
      }
      state.localRejoinSnapshot = snapshot;
      hydrateLocalFromSnapshot(snapshot);
    });
  }

  if (localClearButton) {
    localClearButton.addEventListener("click", () => {
      clearLocalRejoinSnapshot();
      updateLocalRejoinCard();
    });
  }

  updateRejoinCard();
  updateLocalRejoinCard();
  initHashRouting();
  updateHeroActions();
  updateHeroRoomCodeVisibility();
  connect();
}

export function initLegacyApp() {
  if (window[LEGACY_BOOTSTRAP_FLAG]) {
    return;
  }
  window[LEGACY_BOOTSTRAP_FLAG] = true;
  setup();
}

function renderLocalSetup() {
  renderLocalSetupScreen({
    state,
    getFruit,
    updateFruitPicker,
    updateHeroActions
  });
}

function initSettingsModal() {
  const openButton = document.getElementById("open-settings");
  const closeButton = document.getElementById("close-settings");
  const modal = document.getElementById("settings-modal");
  if (!openButton || !closeButton || !modal) return;

  const closeModal = () => {
    modal.classList.add("hidden");
    if (state.settingsLastFocus instanceof HTMLElement) {
      state.settingsLastFocus.focus();
    }
    state.settingsLastFocus = null;
  };

  openButton.addEventListener("click", () => {
    state.settingsLastFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : openButton;
    modal.classList.remove("hidden");
    closeButton.focus();
  });

  closeButton.addEventListener("click", closeModal);

  modal.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.closeSettings === "true") {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
      closeModal();
    }
  });
}

function updateRejoinCard() {
  const card = document.getElementById("rejoin-card");
  const codeEl = document.getElementById("rejoin-code");
  const startedEl = document.getElementById("online-rejoin-started");
  if (!card || !codeEl || !startedEl) return;
  if (state.lastRoomCode) {
    codeEl.textContent = state.lastRoomCode;
    startedEl.textContent = formatStartedAgo(state.lastRoomStartedAt);
    card.classList.remove("hidden");
    card.classList.add("has-alert");
  } else {
    card.classList.add("hidden");
    card.classList.remove("has-alert");
  }
  updateLandingRejoinIndicators();
}

function updateLandingRejoinIndicators() {
  const hasLocalRejoin = Boolean(state.localRejoinSnapshot || loadLocalRejoinSnapshot());
  const hasOnlineRejoin = Boolean(state.lastRoomCode);
  if (landingSegmented) {
    landingSegmented.classList.toggle("has-alert", hasLocalRejoin || hasOnlineRejoin);
  }
  if (landingTabLocal) {
    landingTabLocal.classList.toggle("has-alert", hasLocalRejoin);
  }
  if (landingTabOnline) {
    landingTabOnline.classList.toggle("has-alert", hasOnlineRejoin);
  }
}

function updateLocalRejoinCard() {
  const card = document.getElementById("local-rejoin-card");
  const summary = document.getElementById("local-rejoin-summary");
  if (!card || !summary) return;
  const snapshot = state.localRejoinSnapshot || loadLocalRejoinSnapshot();
  if (snapshot && isValidLocalRejoinSnapshot(snapshot)) {
    state.localRejoinSnapshot = snapshot;
    summary.textContent = getLocalRejoinLabel(snapshot);
    card.classList.remove("hidden");
    card.classList.add("has-alert");
  } else {
    state.localRejoinSnapshot = null;
    card.classList.add("hidden");
    card.classList.remove("has-alert");
  }
  updateLandingRejoinIndicators();
}

function setLandingMode(mode, options = {}) {
  const nextMode = mode === "online" ? "online" : "local";
  const modeChanged = state.landingMode !== nextMode;
  const shouldAnimate = options.animate ?? modeChanged;
  state.landingMode = nextMode;
  if (landingTrack) {
    landingTrack.dataset.mode = nextMode;
  }
  if (landingSegmented) {
    landingSegmented.dataset.mode = nextMode;
  }
  if (landingTabLocal) {
    const isLocal = nextMode === "local";
    landingTabLocal.classList.toggle("active", isLocal);
    landingTabLocal.setAttribute("aria-selected", String(isLocal));
    landingTabLocal.tabIndex = isLocal ? 0 : -1;
  }
  if (landingTabOnline) {
    const isOnline = nextMode === "online";
    landingTabOnline.classList.toggle("active", isOnline);
    landingTabOnline.setAttribute("aria-selected", String(isOnline));
    landingTabOnline.tabIndex = isOnline ? 0 : -1;
  }
  updateLocalRejoinCard();
  updateRejoinCard();
  if (shouldAnimate) {
    if (nextMode === "online") {
      staggerLandingPanel(landingPanelOnline);
    } else {
      staggerLandingPanel(landingPanelLocal);
    }
  }
}

function resetJoinFlow() {
  state.joinStep = "code";
  state.joinValidatedCode = null;
  state.joinPreview = null;
  state.joinValidating = false;
  state.joinFruit = null;
}

function renderJoinSetup() {
  const joinCode = document.getElementById("join-code");
  const joinButton = document.getElementById("join-room");
  const joinHint = document.getElementById("join-step-hint");
  const joinPicker = document.getElementById("join-fruit-picker");
  if (!joinCode || !joinButton || !joinHint || !joinPicker) return;

  const isCodeStep = state.joinStep === "code";
  joinCode.disabled = state.joinValidating;
  joinCode.placeholder = "ABCD";
  joinPicker.classList.toggle("hidden", isCodeStep);
  joinButton.textContent = isCodeStep ? (state.joinValidating ? "Checking..." : "Continue") : "Join room";
  joinButton.disabled = state.joinValidating;

  if (isCodeStep) {
    joinHint.textContent = "Enter your room code to continue.";
    joinPicker.querySelectorAll(".fruit-option").forEach((button) => {
      button.classList.remove("p1-locked");
      button.removeAttribute("aria-disabled");
    });
    return;
  }

  const hostTheme = state.joinPreview?.host?.theme || null;
  joinHint.textContent = "Pick your player fruit.";
  updateFruitPicker(joinPicker, state.joinFruit, hostTheme ? [hostTheme] : []);
  joinPicker.querySelectorAll(".fruit-option").forEach((button) => {
    const fruitId = button.dataset.fruit || "";
    button.classList.remove("p1-locked");
    button.removeAttribute("aria-disabled");
    if (hostTheme && fruitId === hostTheme) {
      button.classList.add("p1-locked");
      button.setAttribute("aria-disabled", "true");
    }
  });
}
