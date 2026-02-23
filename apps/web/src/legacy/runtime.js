import { assertRoomShape } from "../contracts/roomState.js";
import { AVATARS, getAvatar, getAvatarByTheme } from "../domain/avatars.js";
import { isTicTacToeSurfaceGame, localGames, listLocalGames } from "../domain/localGames.js";
import { resolvePickerGames } from "../domain/games/picker.js";
import { createWsClient } from "../net/wsClient.js";
import { actions } from "../state/actions.js";
import { reducer } from "../state/reducer.js";
import { getLeaderId } from "../state/selectors.js";
import { createStore } from "../state/store.js";
import { renderLocalSetupScreen } from "../ui/screens/localSetup.js";
import { renderPickHint } from "../ui/screens/pickHint.js";
import { setupAvatarPicker, updateAvatarPicker } from "../ui/shared/avatarPicker.js";
import { PLAYER_CARD_VARIANTS } from "../ui/shared/playerCardContract.js";
import { createPlayerCardElement } from "../ui/shared/playerCardDom.js";
import { getPatternConfig, resetPatternConfig, setPatternConfig } from "../ui/shared/patternSystem.ts";
import { createToastController } from "../ui/shared/toast.js";
import playerAvatar from "../assets/player.svg";
import playerAvatarAlt from "../assets/player2.svg";
import { normalizeRoomCode, parseScreenRoute } from "./hashRoute.js";
import {
  clamp,
  classifySwipeAxis,
  computeSwipeVelocityPxPerMs,
  hasMetDragActivation,
  resolveLandingSnapMode,
  shouldSuppressClick
} from "./gestures.js";
import {
  confirmLocalHandoff,
  createInitialLocalPrivacyState,
  queueLocalHandoff,
  shouldShowLocalPassScreen
} from "./localPrivacy.js";
import { copyRoomInviteLink } from "./shareLink.js";

const LOCAL_REJOIN_KEY = "multipass_last_local_match";
const ONLINE_REJOIN_AT_KEY = "multipass_last_room_started_at";
const ONLINE_UI_PREFS_KEY = "multipass_online_ui_prefs";
const SEAT_TOKEN_KEY = "multipass_seat_token";
const HONORIFIC_TOGGLE_SELECTOR = 'input[data-honorific-toggle="true"]';
const SCREEN_TO_HASH = Object.freeze({
  landing: "",
  local: "#local",
  host: "#host",
  join: "#join",
  lobby: "#lobby",
  pick: "#pick",
  wait: "#wait",
  game: "#game",
  pass: "#pass",
  winner: "#winner",
  devkit: "#devkit"
});
const HASH_TO_SCREEN = Object.freeze(
  Object.fromEntries(Object.entries(SCREEN_TO_HASH).map(([screen, hash]) => [hash, screen]))
);
const ROOM_REQUIRED_SCREENS = new Set(["lobby", "pick", "wait", "game", "pass", "winner"]);
const ONLINE_HERO_ROOM_SCREENS = new Set(["lobby", "pick", "wait", "game", "winner"]);
const LEGACY_BOOTSTRAP_FLAG = "__multipassLegacyInitialized";
const PROD_WS_FALLBACK_URL = "wss://api.loreandorder.com";
const IS_DEV_BUILD = Boolean(typeof import.meta !== "undefined" && import.meta.env?.DEV);
const RECENT_LEAVE_GUARD_MS = 5000;
const PLAYER_THEME_CLASS_NAMES = ["theme-red", "theme-yellow", "theme-green", "theme-blue"];
const BOARD_DRAG_ACTIVATION_PX = 6;
const BOARD_CLICK_SUPPRESS_MS = 260;
const LANDING_DRAG_ACTIVATION_PX = 14;
const LANDING_SWIPE_DISTANCE_RATIO = 0.18;
const LANDING_SWIPE_MIN_DISTANCE_PX = 32;
const LANDING_SWIPE_VELOCITY_PX_PER_MS = 0.36;
const JOIN_CODE_LENGTH = 4;
const JOIN_CODE_DISALLOWED_CHARS_REGEX = /[IO]/g;
const FIXED_FOOTER_SCREEN_SLOT_MAP = Object.freeze({
  landing: "app-fixed-footer-mode",
  local: "local-continue",
  host: "create-room",
  join: "join-room",
  lobby: "ready-cta",
  winner: "winner-play-again"
});
const HERO_ACTION_BUTTON_IDS = ["hero-left-action", "hero-left-action-2", "hero-left-action-3"];

function createInitialBoardGestureState() {
  return {
    activePointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startedAt: 0,
    isDragging: false,
    previewIndex: null,
    suppressClickUntil: 0
  };
}

function createInitialLandingGestureState() {
  return {
    activePointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startedAt: 0,
    startMode: "local",
    startOffsetPx: 0,
    panelWidthPx: 0,
    isDragging: false,
    suppressClickUntil: 0
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
    recentLeftRoomCode: null,
    recentLeftRoomUntil: 0,
    lastLeaderId: null,
    lastWinSignature: null,
    hostAvatar: null,
    joinAvatar: null,
    joinStep: "code",
    joinValidatedCode: null,
    joinPreview: null,
    joinValidating: false,
    joinCodeStatusMessage: "",
    pendingDeepLinkJoinCode: null,
    joinValidationSource: null,
    localRejoinSnapshot: null,
    localAvatars: { one: null, two: null },
    localStep: "p1",
    prevLocalStep: "p1",
    settingsLastFocus: null,
    deferredInstallPrompt: null,
    isAppInstalled: false,
    localPrivacy: createInitialLocalPrivacyState(),
    localBattleshipOrientation: "h",
    localBattleshipPendingTargetIndex: null,
    localBattleshipLastPhase: null,
    hostHonorific: "mr",
    joinHonorific: "mr",
    localHonorifics: { p1: "mr", p2: "mr" },
    landingMode: "local",
    landingModeProgress: 0,
    devkitReturnScreen: "landing",
    boardGesture: createInitialBoardGestureState(),
    landingGesture: createInitialLandingGestureState()
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
  pass: document.getElementById("screen-pass"),
  winner: document.getElementById("screen-winner"),
  devkit: document.getElementById("screen-devkit")
};
const landingTrack = document.getElementById("landing-track");
const landingSegmented = document.querySelector(".landing-segmented");
const landingTabLocal = document.getElementById("landing-tab-local");
const landingTabOnline = document.getElementById("landing-tab-online");
const landingPanelLocal = document.getElementById("landing-panel-local");
const landingPanelOnline = document.getElementById("landing-panel-online");
const landingCarousel = document.querySelector(".landing-carousel");

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
  return parseScreenRoute(hash, HASH_TO_SCREEN).screen;
}

function parseHashRoute(hash = window.location.hash) {
  return parseScreenRoute(hash, HASH_TO_SCREEN);
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

function normalizeHonorific(value) {
  return String(value || "").trim().toLowerCase() === "mrs" ? "mrs" : "mr";
}

function formatHonorificName(name, honorific = "mr") {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "";
  const base = trimmed.replace(/^(mr|mrs)\.?\s+/i, "").trim() || trimmed;
  return `${normalizeHonorific(honorific) === "mrs" ? "Mrs" : "Mr"} ${base}`;
}

function sanitizeJoinCode(rawCode) {
  return normalizeRoomCode(rawCode)
    .replace(JOIN_CODE_DISALLOWED_CHARS_REGEX, "")
    .slice(0, JOIN_CODE_LENGTH);
}

function getJoinCodeSlotInputs() {
  const slots = [];
  for (let index = 0; index < JOIN_CODE_LENGTH; index += 1) {
    const slot = document.getElementById(`join-code-slot-${index}`);
    if (slot instanceof HTMLInputElement) {
      slots.push(slot);
    }
  }
  return slots;
}

function setJoinCodeSlotStates(slots = getJoinCodeSlotInputs()) {
  slots.forEach((slot) => {
    slot.classList.toggle("is-filled", Boolean(slot.value));
  });
}

function readJoinCodeFromSlots(slots = getJoinCodeSlotInputs()) {
  return sanitizeJoinCode(slots.map((slot) => slot.value || "").join(""));
}

function focusJoinCodeSlot(index) {
  const slots = getJoinCodeSlotInputs();
  const slot = slots[index];
  if (!slot) return;
  slot.focus();
  slot.select();
}

function setJoinCodeSlots(code, options = {}) {
  const slots = getJoinCodeSlotInputs();
  if (slots.length !== JOIN_CODE_LENGTH) return;
  const normalized = sanitizeJoinCode(code);
  for (let index = 0; index < JOIN_CODE_LENGTH; index += 1) {
    slots[index].value = normalized[index] || "";
  }
  setJoinCodeSlotStates(slots);
  const focusIndex = Number.isInteger(options.focusIndex) ? options.focusIndex : null;
  if (focusIndex !== null) {
    focusJoinCodeSlot(Math.max(0, Math.min(JOIN_CODE_LENGTH - 1, focusIndex)));
  }
}

function syncCanonicalJoinCodeFromSlots() {
  const joinCodeInput = document.getElementById("join-code");
  const code = readJoinCodeFromSlots();
  if (joinCodeInput instanceof HTMLInputElement) {
    joinCodeInput.value = code;
  }
  return code;
}

function syncJoinCodeSlotsFromCanonical(options = {}) {
  const joinCodeInput = document.getElementById("join-code");
  if (!(joinCodeInput instanceof HTMLInputElement)) return "";
  const code = sanitizeJoinCode(joinCodeInput.value);
  if (joinCodeInput.value !== code) {
    joinCodeInput.value = code;
  }
  setJoinCodeSlots(code, options);
  return code;
}

function clearJoinCodeStatusMessage() {
  state.joinCodeStatusMessage = "";
  const joinHint = document.getElementById("join-step-hint");
  if (!(joinHint instanceof HTMLElement)) return;
  if (state.joinStep !== "code" || state.joinValidating) return;
  joinHint.textContent = "Enter 4-letter code";
}

function getJoinCodeErrorStatusMessage(rawMessage) {
  if (rawMessage === "Room not found.") return "Room not found";
  if (rawMessage === "Room is full.") return "Room is full";
  return "Couldn't verify room";
}

function writeJoinCodeIntoSlots(rawCode, startIndex = 0) {
  const slots = getJoinCodeSlotInputs();
  if (slots.length !== JOIN_CODE_LENGTH) return "";
  const chars = sanitizeJoinCode(rawCode).split("");
  const offset = Math.max(0, Math.min(startIndex, JOIN_CODE_LENGTH - 1));
  for (let index = offset; index < JOIN_CODE_LENGTH; index += 1) {
    slots[index].value = "";
  }
  for (let index = 0; index < chars.length && offset + index < JOIN_CODE_LENGTH; index += 1) {
    slots[offset + index].value = chars[index];
  }
  setJoinCodeSlotStates(slots);
  return syncCanonicalJoinCodeFromSlots();
}

function setJoinCodeClusterDisabled(disabled) {
  getJoinCodeSlotInputs().forEach((slot) => {
    slot.disabled = disabled;
  });
}

function autoValidateJoinCodeIfReady(code) {
  if (state.joinStep !== "code" || state.joinValidating) return false;
  if (code.length !== JOIN_CODE_LENGTH) return false;
  beginJoinValidation(code, { source: "manual" });
  return true;
}

function initJoinCodeCluster() {
  const slots = getJoinCodeSlotInputs();
  if (slots.length !== JOIN_CODE_LENGTH) return;
  if (slots[0].dataset.joinCodeInit === "true") return;
  slots.forEach((slot) => {
    slot.dataset.joinCodeInit = "true";
  });

  slots.forEach((slot, index) => {
    slot.addEventListener("focus", () => {
      slot.classList.add("is-active");
    });
    slot.addEventListener("blur", () => {
      slot.classList.remove("is-active");
    });
    slot.addEventListener("keydown", (event) => {
      if (event.key === "Backspace" && !slot.value) {
        if (index > 0) {
          event.preventDefault();
          const previous = slots[index - 1];
          previous.value = "";
          setJoinCodeSlotStates(slots);
          syncCanonicalJoinCodeFromSlots();
          clearJoinCodeStatusMessage();
          focusJoinCodeSlot(index - 1);
        }
        return;
      }
      if (event.key.length !== 1) return;
      const upper = event.key.toUpperCase();
      const isLetter = upper >= "A" && upper <= "Z";
      const isDisallowed = upper === "I" || upper === "O";
      if (!isLetter || isDisallowed) {
        event.preventDefault();
      }
    });
    slot.addEventListener("paste", (event) => {
      event.preventDefault();
      const clipboardText = event.clipboardData?.getData("text") || "";
      const code = writeJoinCodeIntoSlots(clipboardText, index);
      clearJoinCodeStatusMessage();
      if (code.length < JOIN_CODE_LENGTH) {
        focusJoinCodeSlot(Math.min(index + code.length, JOIN_CODE_LENGTH - 1));
        return;
      }
      autoValidateJoinCodeIfReady(code);
    });
    slot.addEventListener("input", () => {
      clearJoinCodeStatusMessage();
      const sanitizedValue = sanitizeJoinCode(slot.value);
      if (sanitizedValue.length > 1) {
        const code = writeJoinCodeIntoSlots(sanitizedValue, index);
        if (code.length === JOIN_CODE_LENGTH) {
          autoValidateJoinCodeIfReady(code);
          return;
        }
        focusJoinCodeSlot(Math.min(index + sanitizedValue.length, JOIN_CODE_LENGTH - 1));
        return;
      }
      slot.value = sanitizedValue.slice(-1);
      setJoinCodeSlotStates(slots);
      const code = syncCanonicalJoinCodeFromSlots();
      if (slot.value && index < JOIN_CODE_LENGTH - 1) {
        focusJoinCodeSlot(index + 1);
      }
      autoValidateJoinCodeIfReady(code);
    });
  });
}

function currentLocalStepKey() {
  return state.localStep === "p2" ? "p2" : "p1";
}

function getArtSrcForHonorific(honorific) {
  return normalizeHonorific(honorific) === "mrs" ? playerAvatarAlt : playerAvatar;
}

function getPlayerHonorific(player, fallbackHonorific = "mr") {
  const direct = normalizeHonorific(player?.honorific || "");
  if (player?.honorific) return direct;
  const rawName = String(player?.name || "").trim().toLowerCase();
  if (rawName.startsWith("mrs ")) return "mrs";
  if (rawName.startsWith("mr ")) return "mr";
  return normalizeHonorific(fallbackHonorific);
}

function getPlayerArtSrc(player, fallbackHonorific = "mr") {
  return getArtSrcForHonorific(getPlayerHonorific(player, fallbackHonorific));
}

function getDisplayPlayerName(player, fallback = "Player") {
  if (!player) return fallback;
  if (player.name) return player.name;
  const avatar = getAvatarByTheme(player.theme);
  if (avatar?.name) return formatHonorificName(avatar.name, getPlayerHonorific(player, "mr"));
  return fallback;
}

function syncHonorificToggleInputs() {
  const hostToggle = document.getElementById("host-honorific-toggle");
  if (hostToggle instanceof HTMLInputElement) {
    hostToggle.checked = state.hostHonorific === "mrs";
  }

  const joinToggle = document.getElementById("join-honorific-toggle");
  if (joinToggle instanceof HTMLInputElement) {
    joinToggle.checked = state.joinHonorific === "mrs";
  }

  const localToggle = document.getElementById("local-honorific-toggle");
  if (localToggle instanceof HTMLInputElement) {
    localToggle.checked = state.localHonorifics[currentLocalStepKey()] === "mrs";
  }
}

function resolvePickerHonorific(containerId, button, fallbackHonorific = "mr") {
  const normalizedFallback = normalizeHonorific(fallbackHonorific);
  if (!(button instanceof HTMLElement)) return normalizedFallback;
  const isLocked = button.classList.contains("p1-locked");
  if (containerId === "host-avatar-picker") {
    return normalizeHonorific(state.hostHonorific);
  }
  if (containerId === "join-avatar-picker") {
    if (isLocked) {
      return getPlayerHonorific(state.joinPreview?.host, "mr");
    }
    return normalizeHonorific(state.joinHonorific);
  }
  if (containerId === "local-avatar-grid") {
    if (isLocked) {
      return normalizeHonorific(state.localHonorifics.p1);
    }
    return normalizeHonorific(state.localHonorifics[currentLocalStepKey()]);
  }
  return normalizedFallback;
}

function updateAvatarLabelsInContainer(containerId, fallbackHonorific = "mr") {
  const container = document.getElementById(containerId);
  if (!(container instanceof HTMLElement)) return;
  container.querySelectorAll(".avatar-option").forEach((button) => {
    if (!(button instanceof HTMLElement)) return;
    const avatarId = button.dataset.avatar || "";
    const avatar = getAvatar(avatarId);
    const honorific = resolvePickerHonorific(containerId, button, fallbackHonorific);
    const displayName = avatar ? formatHonorificName(avatar.name, honorific) : "";
    if (!displayName) return;

    const labelEl = button.querySelector(".avatar-name");
    if (labelEl) {
      labelEl.textContent = displayName;
    }
    const lockedByPlayerOne = button.classList.contains("p1-locked");
    button.setAttribute("aria-label", lockedByPlayerOne ? `${displayName}, already selected` : displayName);
  });
}

function refreshAvatarPickerLabels() {
  updateAvatarLabelsInContainer("host-avatar-picker", state.hostHonorific);
  updateAvatarLabelsInContainer("join-avatar-picker", state.joinHonorific);
  updateAvatarLabelsInContainer("local-avatar-grid", state.localHonorifics[currentLocalStepKey()]);
}

function updateAvatarArtInContainer(containerId, fallbackHonorific = "mr") {
  const container = document.getElementById(containerId);
  if (!(container instanceof HTMLElement)) return;
  container.querySelectorAll(".avatar-option").forEach((button) => {
    if (!(button instanceof HTMLElement)) return;
    const honorific = resolvePickerHonorific(containerId, button, fallbackHonorific);
    const src = getArtSrcForHonorific(honorific);
    const node = button.querySelector(".player-art img");
    if (!(node instanceof HTMLImageElement)) return;
    node.src = src;
  });
}

function refreshStaticPlayerArt() {
  updateAvatarArtInContainer("host-avatar-picker", state.hostHonorific);
  updateAvatarArtInContainer("join-avatar-picker", state.joinHonorific);
  updateAvatarArtInContainer("local-avatar-grid", state.localHonorifics[currentLocalStepKey()]);
}

function applyHonorificForInput(inputId, honorific) {
  const normalized = normalizeHonorific(honorific);
  if (inputId === "host-honorific-toggle") {
    state.hostHonorific = normalized;
  } else if (inputId === "join-honorific-toggle") {
    state.joinHonorific = normalized;
  } else if (inputId === "local-honorific-toggle") {
    state.localHonorifics[currentLocalStepKey()] = normalized;
  }

  syncHonorificToggleInputs();
  refreshAvatarPickerLabels();
  refreshStaticPlayerArt();

  if (state.room) {
    renderRoom();
    return;
  }
  if (state.activeScreen === "local") {
    renderLocalSetup();
  }
  if (state.activeScreen === "join") {
    renderJoinSetup();
  }
}

function initHonorificToggle() {
  syncHonorificToggleInputs();
  refreshAvatarPickerLabels();
  refreshStaticPlayerArt();
  document.querySelectorAll(HONORIFIC_TOGGLE_SELECTOR).forEach((node) => {
    if (!(node instanceof HTMLInputElement)) return;
    node.addEventListener("change", () => {
      applyHonorificForInput(node.id, node.checked ? "mrs" : "mr");
    });
  });
}

function clearRecentLeaveGuard() {
  state.recentLeftRoomCode = null;
  state.recentLeftRoomUntil = 0;
}

function armRecentLeaveGuard(roomCode) {
  const normalizedCode = normalizeRoomCode(roomCode || "");
  if (!normalizedCode) {
    clearRecentLeaveGuard();
    return;
  }
  state.recentLeftRoomCode = normalizedCode;
  state.recentLeftRoomUntil = Date.now() + RECENT_LEAVE_GUARD_MS;
}

function shouldIgnoreRoomState(roomCode) {
  if (!state.recentLeftRoomCode) return false;
  if (Date.now() > state.recentLeftRoomUntil) {
    clearRecentLeaveGuard();
    return false;
  }
  return normalizeRoomCode(roomCode || "") === state.recentLeftRoomCode;
}

function normalizeTargetScreen(screen) {
  if (!screen || !(screen in screens) || !screens[screen]) return "landing";
  if (ROOM_REQUIRED_SCREENS.has(screen) && !state.room) return "landing";
  if (screen === "game" && !state.room?.game) {
    return state.room ? resolveScreen(state.room) : "landing";
  }
  if (screen === "pass" && !shouldShowLocalPassScreen(state.room, state.localPrivacy)) {
    return state.room ? resolveScreen(state.room) : "landing";
  }
  if (screen === "winner") {
    const gameState = state.room?.game?.state;
    const ended = Boolean(gameState?.winnerId || gameState?.draw);
    return ended ? "game" : (state.room ? resolveScreen(state.room) : "landing");
  }
  return screen;
}

function handleBrowserNavigation(targetScreen, options = {}) {
  const joinCode = options.joinCode || null;
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

  if (normalizedTarget === "join") {
    state.mode = "online";
  }

  showScreen(normalizedTarget, { history: "none" });
  writeScreenHash(normalizedTarget, { mode: "replace" });

  if (normalizedTarget === "join") {
    const joinCodeInput = document.getElementById("join-code");
    if (joinCodeInput && joinCode) {
      const normalizedJoinCode = sanitizeJoinCode(joinCode);
      resetJoinFlow();
      joinCodeInput.value = normalizedJoinCode;
      setJoinCodeSlots(normalizedJoinCode);
      beginJoinValidation(normalizedJoinCode, { source: "deep_link" });
    } else {
      state.pendingDeepLinkJoinCode = null;
      state.joinValidationSource = null;
    }
  }
}

function initHashRouting() {
  window.addEventListener("hashchange", () => {
    const route = parseHashRoute(window.location.hash);
    const target = route.screen || "landing";
    handleBrowserNavigation(target, { joinCode: route.joinCode });
  });

  window.addEventListener("popstate", (event) => {
    const route = parseHashRoute(window.location.hash);
    const stateScreen = event.state?.screen;
    const target = normalizeTargetScreen(route.screen || stateScreen || "landing");

    handleBrowserNavigation(target, { joinCode: route.joinCode });
  });

  const initialRoute = parseHashRoute(window.location.hash);
  const initialTarget = normalizeTargetScreen(initialRoute.screen || "landing");
  handleBrowserNavigation(initialTarget, { joinCode: initialRoute.joinCode });
}

function showScreen(key, options = {}) {
  const historyMode = options.history || "push";
  const historyState = options.historyState || {};
  const allowSameHashPush = Boolean(options.allowSameHashPush);
  state.activeScreen = key;
  document.body.dataset.screen = key;
  localStorage.setItem("multipass_last_screen", key);
  Object.entries(screens).forEach(([name, element]) => {
    if (!element) return;
    element.classList.toggle("active", name === key);
  });
  writeScreenHash(key, {
    mode: historyMode,
    historyState,
    allowSameHashPush
  });
  updateFixedFooter();
  updateHeroActions();
  updateHeroRoomCodeVisibility();
}

function updateFixedFooter() {
  const footer = document.getElementById("app-fixed-footer");
  if (!(footer instanceof HTMLElement)) return;

  const activeSlotId = FIXED_FOOTER_SCREEN_SLOT_MAP[state.activeScreen] || null;
  footer.querySelectorAll(".app-fixed-footer-slot").forEach((slot) => {
    slot.classList.add("hidden");
  });

  if (!activeSlotId) {
    document.body.removeAttribute("data-fixed-footer-active");
    footer.classList.add("hidden");
    return;
  }

  const activeSlot = document.getElementById(activeSlotId);
  if (activeSlot instanceof HTMLElement) {
    activeSlot.classList.remove("hidden");
  }
  document.body.setAttribute("data-fixed-footer-active", "true");
  footer.classList.remove("hidden");
}

function getPrimaryHeroActionConfig() {
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
  if (state.activeScreen === "devkit") {
    return {
      label: "Back",
      action: () => {
        const fallback = "landing";
        const target = screens[state.devkitReturnScreen] ? state.devkitReturnScreen : fallback;
        state.devkitReturnScreen = fallback;
        showScreen(target, { history: "push" });
      }
    };
  }
  if (isLocalMode() && state.room && (
    state.activeScreen === "lobby" ||
    state.activeScreen === "pick" ||
    state.activeScreen === "game" ||
    state.activeScreen === "pass" ||
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

function getLobbyEndGameActionConfig() {
  if (state.activeScreen !== "lobby") return null;
  if (isLocalMode()) return null;
  if (!state.room?.game) return null;
  if (state.room.game.state?.winnerId || state.room.game.state?.draw) return null;
  return {
    label: "End game",
    disabled: Boolean(state.room.endRequest),
    action: () => {
      if (!state.room || !state.room.game) return;
      send({ type: "end_game_request" });
    }
  };
}

function getWinnerHomeActionConfig() {
  if (state.activeScreen !== "winner" || !state.room) return null;
  return {
    label: "Home",
    action: () => {
      state.keepPickOpen = false;
      if (!isLocalMode() && state.room?.code) {
        setPreferredRoomScreen(state.room.code, "lobby");
        setDismissedWinnerSignature(state.room.code, getEndSignature(state.room));
      }
      showScreen("lobby", { history: "push" });
    }
  };
}

function getHeroActionConfigs() {
  const configs = [];
  const primary = getPrimaryHeroActionConfig();
  if (primary) configs.push(primary);

  const lobbySecondary = getLobbyEndGameActionConfig();
  if (lobbySecondary) configs.push(lobbySecondary);

  const winnerSecondary = getWinnerHomeActionConfig();
  if (winnerSecondary) configs.push(winnerSecondary);

  return configs.slice(0, HERO_ACTION_BUTTON_IDS.length);
}

function updateHeroActions() {
  const buttons = HERO_ACTION_BUTTON_IDS.map((id) => document.getElementById(id)).filter(Boolean);
  if (!buttons.length) return;

  const configs = getHeroActionConfigs();
  buttons.forEach((button, index) => {
    const element = button;
    const config = configs[index];
    if (!config) {
      element.classList.add("hidden");
      element.disabled = false;
      element.onclick = null;
      return;
    }
    element.classList.remove("hidden");
    element.textContent = config.label;
    element.disabled = Boolean(config.disabled);
    element.onclick = config.action;
  });
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
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
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

function logWs(message, details) {
  if (typeof details === "undefined") {
    console.info(`[multipass/ws] ${message}`);
    return;
  }
  console.info(`[multipass/ws] ${message}`, details);
}

function getWebSocketUrl() {
  // 1) Build-time production override from CI/deploy.
  const envOverride = typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_WS_URL
    : null;
  if (envOverride) return envOverride;
  // 2) Local override for live debugging in browser.
  const override = window.localStorage?.getItem("multipass_ws_url");
  if (override) return override;
  // 3) Dev fallback when running Vite + local API server.
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.hostname}:3001`;
  }
  // 4) Legacy localhost fallback if app is served by local static host.
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.host}`;
  }
  return PROD_WS_FALLBACK_URL;
}

function runPendingJoinValidation() {
  const code = state.pendingDeepLinkJoinCode;
  if (!code) return false;
  state.pendingDeepLinkJoinCode = null;
  send({
    type: "validate_room",
    code,
    clientId: state.clientId,
    seatToken: state.seatToken
  });
  return true;
}

function connect() {
  const wsUrl = getWebSocketUrl();
  let hasConnected = false;
  logWs(`connecting to ${wsUrl}`);
  const socket = wsClient.connect();
  dispatch(actions.wsSet(socket));

  wsClient.subscribe("open", () => {
    hasConnected = true;
    logWs("open");
    if (runPendingJoinValidation()) {
      return;
    }
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
      if (shouldIgnoreRoomState(message.room?.code)) {
        return;
      }
      if (!assertRoomShape(message.room)) {
        return;
      }
      if (
        state.recentLeftRoomCode &&
        normalizeRoomCode(message.room?.code || "") !== state.recentLeftRoomCode
      ) {
        clearRecentLeaveGuard();
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
      renderRoom();
      const endSignature = getEndSignature(state.room);
      state.lastWinSignature = endSignature || null;
      showScreen(nextScreen, { history: "replace" });
      return;
    }

    if (message.type === "room_preview") {
      state.joinValidating = false;
      state.joinValidationSource = null;
      state.joinCodeStatusMessage = "";
      state.joinPreview = message.room || null;
      state.joinValidatedCode = message.room?.code || null;
      const canRejoin = Boolean(message.room?.canRejoin);
      if (canRejoin) {
        state.joinStep = "code";
        state.joinValidating = true;
        renderJoinSetup();
        clearRecentLeaveGuard();
        send({
          type: "join_room",
          code: state.joinValidatedCode,
          clientId: state.clientId,
          seatToken: state.seatToken
        });
        return;
      }
      state.joinStep = "avatar";
      state.joinAvatar = null;
      renderJoinSetup();
      return;
    }

    if (message.type === "error") {
      const joinValidationSource = state.joinValidationSource;
      if (state.joinValidating) {
        state.joinValidating = false;
        state.joinCodeStatusMessage = joinValidationSource === "manual"
          ? getJoinCodeErrorStatusMessage(message.message)
          : "";
        state.joinValidationSource = null;
        renderJoinSetup();
      }
      if (joinValidationSource === "deep_link") {
        if (message.message === "Room not found.") {
          showToast("This invite is expired. Ask for a new link.");
          showScreen("join", { history: "replace" });
          return;
        }
        if (message.message === "Room is full.") {
          showToast("Room already has two players. Ask host for a fresh room.");
          showScreen("join", { history: "replace" });
          return;
        }
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
        if (message.message === "Pick an avatar.") {
          dispatch(actions.autoJoinCodeSet(null));
          const joinCodeInput = document.getElementById("join-code");
          if (joinCodeInput instanceof HTMLInputElement && state.lastRoomCode) {
            const normalizedJoinCode = sanitizeJoinCode(state.lastRoomCode);
            joinCodeInput.value = normalizedJoinCode;
            setJoinCodeSlots(normalizedJoinCode);
          }
          showToast("Pick an avatar to rejoin.");
          showScreen("join", { history: "replace" });
          return;
        }
      }
      showToast(message.message || "Something went wrong.");
      return;
    }
  });

  wsClient.subscribe("error", (event) => {
    logWs("error", event);
  });

  wsClient.subscribe("close", (event) => {
    logWs(
      `close code=${event?.code ?? "unknown"} reason=${event?.reason || "n/a"} clean=${Boolean(event?.wasClean)}`
    );
    if (!hasConnected) {
      showToast("Could not connect to rooms. Check network/backend and retry.");
      return;
    }
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
  return "game-banner-tic-tac-toe";
}

function isLocalMode() {
  return state.mode === "local";
}

function isHiddenPassGame(gameId) {
  return localGames[gameId]?.visibility === "hidden_pass_device";
}

function getDefaultLocalViewerId(room) {
  if (!room) return null;
  return room.game?.state?.nextPlayerId || room.round?.firstPlayerId || room.players.host?.id || null;
}

function ensureLocalViewer(room) {
  if (!room) return null;
  const currentViewer = state.localPrivacy.viewerPlayerId;
  if (currentViewer && playerById(room, currentViewer)) {
    return currentViewer;
  }
  const fallbackViewer = getDefaultLocalViewerId(room);
  state.localPrivacy.viewerPlayerId = fallbackViewer;
  return fallbackViewer;
}

function resetLocalPrivacy(room) {
  state.localPrivacy = createInitialLocalPrivacyState(getDefaultLocalViewerId(room));
}

function getDisplayStateForRoomGame(room) {
  const gameId = room?.game?.id;
  const fullState = room?.game?.state;
  if (!gameId || !fullState) return null;
  const game = localGames[gameId];
  if (!isLocalMode() || !game) return fullState;
  if (game.visibility !== "hidden_pass_device" || typeof game.getVisibleState !== "function") {
    return fullState;
  }
  const viewerPlayerId = ensureLocalViewer(room);
  return game.getVisibleState(fullState, viewerPlayerId);
}

function shouldShowHeroRoomCode() {
  return !isLocalMode() &&
    ONLINE_HERO_ROOM_SCREENS.has(state.activeScreen) &&
    Boolean(state.room?.code);
}

async function shareRoomInviteLink() {
  await copyRoomInviteLink({
    roomCode: state.room?.code,
    currentHref: window.location.href,
    showToast
  });
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

function saveLocalRejoinSnapshot(room) {
  if (!room) return;
  const snapshot = {
    version: 1,
    mode: "local",
    savedAt: Date.now(),
    localPrivacy: {
      viewerPlayerId: state.localPrivacy.viewerPlayerId || null,
      pendingViewerPlayerId: state.localPrivacy.pendingViewerPlayerId || null,
      stage: state.localPrivacy.stage === "handoff" ? "handoff" : "visible",
      prompt: String(state.localPrivacy.prompt || "")
    },
    localBattleshipOrientation: state.localBattleshipOrientation === "v" ? "v" : "h",
    localBattleshipPendingTargetIndex: Number.isInteger(state.localBattleshipPendingTargetIndex)
      ? state.localBattleshipPendingTargetIndex
      : null,
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
  state.localPrivacy = {
    ...createInitialLocalPrivacyState(getDefaultLocalViewerId(snapshot.room)),
    ...(snapshot.localPrivacy && typeof snapshot.localPrivacy === "object" ? snapshot.localPrivacy : {})
  };
  state.localPrivacy.stage = state.localPrivacy.stage === "handoff" ? "handoff" : "visible";
  state.localBattleshipOrientation = snapshot.localBattleshipOrientation === "v" ? "v" : "h";
  state.localBattleshipPendingTargetIndex = Number.isInteger(snapshot.localBattleshipPendingTargetIndex)
    ? snapshot.localBattleshipPendingTargetIndex
    : null;
  state.localBattleshipLastPhase = snapshot.room?.game?.state?.phase || null;
  renderRoom();
  showScreen(resolveScreen(state.room), { history: "replace" });
}

function createLocalRoom(avatarOne, avatarTwo, honorificOne = "mr", honorificTwo = "mr") {
  const hostHonorific = normalizeHonorific(honorificOne);
  const guestHonorific = normalizeHonorific(honorificTwo);
  const host = {
    id: localId("player"),
    name: formatHonorificName(avatarOne.name, hostHonorific),
    honorific: hostHonorific,
    theme: avatarOne.theme,
    role: "host",
    score: 0,
    gamesWon: 0,
    ready: true,
    connected: true
  };
  const guest = {
    id: localId("player"),
    name: formatHonorificName(avatarTwo.name, guestHonorific),
    honorific: guestHonorific,
    theme: avatarTwo.theme,
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
  const current = state.room.round?.firstPlayerId || state.room.round?.pickerId;
  const next = current ? getOtherLocalPlayerId(state.room, current) : players[0].id;
  state.room.round = {
    pickerId: next,
    firstPlayerId: next,
    shuffleAt: null,
    status: "waiting_game",
    hostGameId: null,
    guestGameId: null,
    resolvedGameId: null,
    hasPickedStarter: Boolean(next)
  };
  state.room.game = null;
  resetLocalPrivacy(state.room);
  state.localBattleshipPendingTargetIndex = null;
  state.localBattleshipLastPhase = null;
  state.room.updatedAt = Date.now();
  handleLocalUpdate();
}

function handleLocalUpdate() {
  saveLocalRejoinSnapshot(state.room);
  updateLocalRejoinCard();
  renderRoom();
  const endSignature = getEndSignature(state.room);
  state.lastWinSignature = endSignature || null;
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
  if (game.visibility === "hidden_pass_device") {
    resetLocalPrivacy(state.room);
  } else {
    state.localPrivacy = createInitialLocalPrivacyState(getDefaultLocalViewerId(state.room));
  }
  state.localBattleshipOrientation = "h";
  state.localBattleshipPendingTargetIndex = null;
  state.localBattleshipLastPhase = null;
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
  state.localPrivacy = createInitialLocalPrivacyState(getDefaultLocalViewerId(state.room));
  state.localBattleshipPendingTargetIndex = null;
  state.localBattleshipLastPhase = null;

  if (!state.room.round.firstPlayerId) {
    const players = getLocalPlayers(state.room);
    const first = players[0]?.id || null;
    state.room.round.firstPlayerId = first;
    state.room.round.pickerId = first;
  }
  startLocalGame(gameId);
}

function applyLocalMove(move) {
  if (!state.room?.game) return;
  const game = localGames[state.room.game.id];
  if (!game) return;
  const actingPlayerId = state.room.game.state.nextPlayerId;
  if (!actingPlayerId) return;
  const previousWinner = state.room.game.state.winnerId;
  const result = game.applyMove(state.room.game.state, move, actingPlayerId);
  if (result?.error) {
    showToast(result.error);
    return;
  }
  state.room.game.state = result.state;
  if (state.room.game.id === "battleships") {
    state.localBattleshipPendingTargetIndex = null;
  }
  if (!previousWinner && result.state.winnerId) {
    const winner = playerById(state.room, result.state.winnerId);
    if (winner) {
      winner.gamesWon += 1;
      winner.score += 1;
    }
  }
  const hasEnded = Boolean(result.state.winnerId || result.state.draw);
  if (game.visibility === "hidden_pass_device") {
    if (hasEnded) {
      state.localPrivacy = queueLocalHandoff(state.localPrivacy, {
        nextViewerPlayerId: null,
        prompt: ""
      });
    } else {
      const nextPlayer = playerById(state.room, result.state.nextPlayerId);
      state.localPrivacy = queueLocalHandoff(state.localPrivacy, {
        nextViewerPlayerId: result.state.nextPlayerId,
        prompt: `Pass now to ${getDisplayPlayerName(nextPlayer, "next player")}.`
      });
    }
  }
  state.room.updatedAt = Date.now();
  handleLocalUpdate();
}

function acknowledgeLocalPassHandoff() {
  if (!state.room || state.localPrivacy.stage !== "handoff") return;
  state.localPrivacy = confirmLocalHandoff(state.localPrivacy);
  state.localBattleshipPendingTargetIndex = null;
  state.room.updatedAt = Date.now();
  handleLocalUpdate();
}

function leaveRoom(options = {}) {
  const historyMode = options.history || "push";
  if (isLocalMode()) {
    leaveLocalMatch({ saveForRejoin: false, history: historyMode });
    return;
  }

  if (state.room?.code) {
    armRecentLeaveGuard(state.room.code);
    setOnlineRejoinData(state.room.code, state.room.createdAt || Date.now());
  }
  updateRejoinCard();

  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify({ type: "leave_room" }));
  }

  state.room = null;
  state.you = null;
  state.autoJoinCode = null;
  state.pendingDeepLinkJoinCode = null;
  state.joinValidationSource = null;
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
  state.localPrivacy = createInitialLocalPrivacyState();
  state.localBattleshipOrientation = "h";
  state.localBattleshipPendingTargetIndex = null;
  state.localBattleshipLastPhase = null;
  document.body.removeAttribute("data-theme");
  updateLocalRejoinCard();
  showScreen("landing", { history });
}

function renderRoom() {
  const room = state.room;
  if (!room) return;

  const heroRoom = document.getElementById("hero-room");
  if (heroRoom) {
    heroRoom.classList.toggle("hidden", !shouldShowHeroRoomCode());
  }
  const codeEl = document.getElementById("room-code");
  if (codeEl) codeEl.textContent = room.code;

  const previousLeader = state.lastLeaderId;
  const leaderId = getLeaderId([room.players.host, room.players.guest]);

  renderLobby(room);
  renderScoreboard(room, leaderId);
  renderWinner(room, leaderId, previousLeader);
  renderPickScreen(room);
  renderWaitScreen(room);
  renderGame(room);
  renderGameList(room);
  renderPassScreen(room);
  renderBattleships(room);
  renderTicTacToe(room);
  renderEndRequest(room);

  state.lastLeaderId = leaderId;
  updateHeroActions();
}

function renderLobby(room) {
  const cta = document.getElementById("ready-cta");
  if (!cta) return;
  if (!room.players.guest) {
    cta.disabled = true;
    cta.textContent = "Waiting for second player";
    cta.classList.add("is-waiting-copy");
    cta.dataset.action = "none";
    return;
  }
  cta.classList.remove("is-waiting-copy");

  const gameActive = Boolean(room.game && !room.game.state?.winnerId && !room.game.state?.draw);

  if (isLocalMode()) {
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

  columns.appendChild(buildScoreDuelPanel(host, guest, leaderId, {
    guestWaiting: isWaitingForGuest
  }));
}

function buildScoreDuelPanel(host, guest, leaderId, options = {}) {
  const panel = document.createElement("div");
  panel.className = "score-duel-panel";

  const sides = document.createElement("div");
  sides.className = "score-duel-sides";

  const hostSide = buildScoreDuelSide(host, "Host", leaderId);
  const guestSide = buildScoreDuelSide(guest, "Guest", leaderId, {
    isWaiting: Boolean(options.guestWaiting)
  });
  const divider = document.createElement("div");
  divider.className = "score-duel-divider";
  divider.setAttribute("aria-hidden", "true");

  sides.appendChild(hostSide);
  sides.appendChild(divider);
  sides.appendChild(guestSide);
  panel.appendChild(sides);

  const scorebarWrap = document.createElement("div");
  scorebarWrap.className = "score-duel-scorebar-wrap";
  scorebarWrap.appendChild(buildSharedScoreBroadcastRow({
    host,
    guest,
    isWaiting: Boolean(options.guestWaiting)
  }));
  panel.appendChild(scorebarWrap);

  return panel;
}

function buildScoreDuelSide(player, label, leaderId, options = {}) {
  const isWaiting = Boolean(options.isWaiting);
  const side = document.createElement("div");
  side.className = "score-duel-side";
  if (label === "Guest") {
    side.classList.add("score-duel-side-guest");
  }
  if (isWaiting) {
    side.classList.add("score-duel-side-waiting");
  }
  const theme = player?.theme || (label === "Host" ? "red" : "green");
  side.classList.add(`theme-${theme}`);
  const showLeaderCrown = Boolean(
    player && leaderId && player.id === leaderId && (player.gamesWon ?? 0) > 0
  );

  const top = document.createElement("div");
  top.className = "score-duel-top";
  const displayName = isWaiting
    ? "Waiting"
    : getDisplayPlayerName(player, label);

  const card = createPlayerCardElement({
    id: player?.id || "",
    name: displayName,
    theme,
    artSrc: getPlayerArtSrc(player),
    isWaiting,
    isLeader: showLeaderCrown
  }, { variant: PLAYER_CARD_VARIANTS.score });

  top.appendChild(card);
  side.appendChild(top);

  return side;
}

function getThemePalette(themeId, fallbackTheme = "red") {
  const theme = themeId || fallbackTheme;
  const tokens = {
    red: { strong: "var(--red-1)", mid: "var(--red-2)", soft: "var(--red-3)" },
    yellow: { strong: "var(--yellow-1)", mid: "var(--yellow-2)", soft: "var(--yellow-3)" },
    green: { strong: "var(--green-1)", mid: "var(--green-2)", soft: "var(--green-3)" },
    blue: { strong: "var(--blue-1)", mid: "var(--blue-2)", soft: "var(--blue-3)" }
  };
  return tokens[theme] || tokens[fallbackTheme];
}

function buildSharedScoreBroadcastRow(options = {}) {
  const isWaiting = Boolean(options.isWaiting);
  const host = options.host || null;
  const guest = options.guest || null;
  const hostName = getDisplayPlayerName(host, "Player 1");
  const guestName = getDisplayPlayerName(guest, "Waiting");
  const hostScoreValue = host ? String(host.gamesWon ?? 0) : "0";
  const guestScoreValue = guest ? String(guest.gamesWon ?? 0) : "--";
  const leftPalette = getThemePalette(host?.theme, "red");
  const rightPalette = getThemePalette(guest?.theme, "green");

  const row = document.createElement("div");
  row.className = "score-broadcast-row";
  if (isWaiting) {
    row.classList.add("score-broadcast-row-waiting");
  }
  row.style.setProperty("--score-left-strong", leftPalette.strong);
  row.style.setProperty("--score-left-mid", leftPalette.mid);
  row.style.setProperty("--score-left-soft", leftPalette.soft);
  row.style.setProperty("--score-right-strong", rightPalette.strong);
  row.style.setProperty("--score-right-mid", rightPalette.mid);
  row.style.setProperty("--score-right-soft", rightPalette.soft);
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", `${hostName} ${hostScoreValue}, ${guestName} ${guestScoreValue}`);

  const leftScore = document.createElement("div");
  leftScore.className = "score-broadcast-score score-broadcast-score-left";
  leftScore.textContent = hostScoreValue;

  const rightScore = document.createElement("div");
  rightScore.className = "score-broadcast-score score-broadcast-score-right";
  if (isWaiting) {
    const rightScoreSkeleton = document.createElement("span");
    rightScoreSkeleton.className = "skeleton-value-bar";
    rightScoreSkeleton.setAttribute("aria-hidden", "true");
    rightScore.appendChild(rightScoreSkeleton);
  } else {
    rightScore.textContent = guestScoreValue;
  }

  row.appendChild(leftScore);
  row.appendChild(rightScore);
  return row;
}

function renderGameList(room) {
  const list = document.getElementById("game-list");
  const statusEl = document.getElementById("pick-status");
  list.innerHTML = "";

  const finished = Boolean(room.game?.state?.winnerId || room.game?.state?.draw);
  const gameActive = Boolean(room.game && !finished);
  const isPlayer = isLocalMode() || state.you?.role === "host" || state.you?.role === "guest";
  const canPick = Boolean(isPlayer && room.players.host && room.players.guest && !gameActive);
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
  const sortedGames = resolvePickerGames(room.games || []).sort((a, b) => {
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

function getTicTacToeState(room) {
  const activeGameId = room?.game?.id || null;
  const isTicTacToeSurface = Boolean(activeGameId) && (
    activeGameId === "tic_tac_toe" ||
    isTicTacToeSurfaceGame(activeGameId)
  );
  if (!room?.game || !isTicTacToeSurface) return null;
  return getDisplayStateForRoomGame(room) || room.game.state;
}

function isTicTacToeCellPlayable(room, index, providedState = null) {
  const numericIndex = Number(index);
  if (!Number.isInteger(numericIndex) || numericIndex < 0) return false;
  const stateGame = providedState || getTicTacToeState(room);
  if (!stateGame || !Array.isArray(stateGame.board) || numericIndex >= stateGame.board.length) return false;
  if (stateGame.winnerId || stateGame.draw) return false;
  if (stateGame.board[numericIndex]) return false;

  const isPlayer = isLocalMode() || state.you?.role === "host" || state.you?.role === "guest";
  if (!isPlayer) return false;

  const isYourTurn = isLocalMode()
    ? Boolean(stateGame.nextPlayerId)
    : stateGame.nextPlayerId === state.you?.playerId;

  return Boolean(isYourTurn);
}

function commitTicTacToeMove(index, options = {}) {
  if (!state.room?.game) return false;
  if (!isTicTacToeCellPlayable(state.room, index)) return false;

  const numericIndex = Number(index);
  if (isLocalMode()) {
    applyLocalMove({ index: numericIndex });
  } else {
    send({ type: "move", gameId: state.room.game?.id, move: { index: numericIndex } });
  }

  if (options.fromPointer) {
    state.boardGesture.suppressClickUntil = Date.now() + BOARD_CLICK_SUPPRESS_MS;
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate(12);
      } catch (error) {
        // ignore unsupported vibration errors
      }
    }
  }

  return true;
}

function getTicTacToeCellIndexFromNode(boardEl, node) {
  if (!(node instanceof Element)) return null;
  const cell = node.closest(".ttt-cell");
  if (!(cell instanceof HTMLElement) || !boardEl.contains(cell)) return null;
  const numericIndex = Number(cell.dataset.index);
  return Number.isInteger(numericIndex) ? numericIndex : null;
}

function getTicTacToeCellIndexFromEvent(boardEl, event) {
  return getTicTacToeCellIndexFromNode(boardEl, event.target);
}

function getTicTacToeCellIndexFromPoint(boardEl, clientX, clientY) {
  const node = document.elementFromPoint(clientX, clientY);
  return getTicTacToeCellIndexFromNode(boardEl, node);
}

function setTicTacToePreviewCell(boardEl, index = null) {
  boardEl.querySelectorAll(".ttt-cell.is-preview, .ttt-cell.is-pressing").forEach((node) => {
    node.classList.remove("is-preview", "is-pressing");
  });

  if (!Number.isInteger(index)) {
    state.boardGesture.previewIndex = null;
    return;
  }

  const previewCell = boardEl.querySelector(`.ttt-cell[data-index="${index}"]`);
  if (!(previewCell instanceof HTMLElement)) {
    state.boardGesture.previewIndex = null;
    return;
  }

  previewCell.classList.add("is-preview");
  state.boardGesture.previewIndex = index;
}

function clearBoardGestureTracking(boardEl, options = {}) {
  const preserveSuppression = Boolean(options.preserveSuppression);
  if (boardEl) {
    setTicTacToePreviewCell(boardEl, null);
  } else {
    state.boardGesture.previewIndex = null;
  }
  state.boardGesture.activePointerId = null;
  state.boardGesture.startX = 0;
  state.boardGesture.startY = 0;
  state.boardGesture.lastX = 0;
  state.boardGesture.lastY = 0;
  state.boardGesture.startedAt = 0;
  state.boardGesture.isDragging = false;
  if (!preserveSuppression) {
    state.boardGesture.suppressClickUntil = 0;
  }
}

function handleTicTacToeBoardPointerDown(event) {
  const boardEl = event.currentTarget;
  if (!(boardEl instanceof HTMLElement)) return;
  if (boardEl.classList.contains("hidden")) return;
  if (state.activeScreen !== "game") return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (state.boardGesture.activePointerId !== null) return;

  const index = getTicTacToeCellIndexFromEvent(boardEl, event);
  if (!Number.isInteger(index) || !isTicTacToeCellPlayable(state.room, index)) return;

  state.boardGesture.activePointerId = event.pointerId;
  state.boardGesture.startX = event.clientX;
  state.boardGesture.startY = event.clientY;
  state.boardGesture.lastX = event.clientX;
  state.boardGesture.lastY = event.clientY;
  state.boardGesture.startedAt = Date.now();
  state.boardGesture.isDragging = false;
  setTicTacToePreviewCell(boardEl, index);

  if (typeof boardEl.setPointerCapture === "function") {
    try {
      boardEl.setPointerCapture(event.pointerId);
    } catch (error) {
      // ignore if pointer capture is unavailable
    }
  }
}

function handleTicTacToeBoardPointerMove(event) {
  const boardEl = event.currentTarget;
  if (!(boardEl instanceof HTMLElement)) return;
  if (state.boardGesture.activePointerId !== event.pointerId) return;

  const deltaX = event.clientX - state.boardGesture.startX;
  const deltaY = event.clientY - state.boardGesture.startY;
  if (!state.boardGesture.isDragging && hasMetDragActivation(deltaX, deltaY, BOARD_DRAG_ACTIVATION_PX)) {
    state.boardGesture.isDragging = true;
  }

  state.boardGesture.lastX = event.clientX;
  state.boardGesture.lastY = event.clientY;

  const hoveredIndex = getTicTacToeCellIndexFromPoint(boardEl, event.clientX, event.clientY);
  const previewIndex = Number.isInteger(hoveredIndex) && isTicTacToeCellPlayable(state.room, hoveredIndex)
    ? hoveredIndex
    : null;
  if (state.boardGesture.previewIndex !== previewIndex) {
    setTicTacToePreviewCell(boardEl, previewIndex);
  }

  if (event.pointerType !== "mouse" && state.boardGesture.isDragging && event.cancelable) {
    event.preventDefault();
  }
}

function handleTicTacToeBoardPointerUp(event) {
  const boardEl = event.currentTarget;
  if (!(boardEl instanceof HTMLElement)) return;
  if (state.boardGesture.activePointerId !== event.pointerId) return;

  const commitIndex = state.boardGesture.previewIndex;
  clearBoardGestureTracking(boardEl, { preserveSuppression: true });

  if (typeof boardEl.releasePointerCapture === "function") {
    try {
      if (boardEl.hasPointerCapture(event.pointerId)) {
        boardEl.releasePointerCapture(event.pointerId);
      }
    } catch (error) {
      // ignore release failures
    }
  }

  if (Number.isInteger(commitIndex)) {
    commitTicTacToeMove(commitIndex, { fromPointer: true });
  }

  if (event.pointerType !== "mouse" && event.cancelable) {
    event.preventDefault();
  }
}

function handleTicTacToeBoardPointerCancel(event) {
  const boardEl = event.currentTarget;
  if (!(boardEl instanceof HTMLElement)) return;
  if (state.boardGesture.activePointerId !== event.pointerId) return;

  clearBoardGestureTracking(boardEl, { preserveSuppression: true });
  if (typeof boardEl.releasePointerCapture === "function") {
    try {
      if (boardEl.hasPointerCapture(event.pointerId)) {
        boardEl.releasePointerCapture(event.pointerId);
      }
    } catch (error) {
      // ignore release failures
    }
  }
}

function handleTicTacToeBoardClick(event) {
  const boardEl = event.currentTarget;
  if (!(boardEl instanceof HTMLElement)) return;
  if (boardEl.classList.contains("hidden")) return;

  if (shouldSuppressClick(state.boardGesture.suppressClickUntil, Date.now(), 0)) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  const index = getTicTacToeCellIndexFromEvent(boardEl, event);
  if (!Number.isInteger(index)) return;
  commitTicTacToeMove(index, { fromPointer: false });
}

function initTicTacToeBoardGestures() {
  const boardEl = document.getElementById("ttt-board");
  if (!(boardEl instanceof HTMLElement)) return;
  if (boardEl.dataset.gestureInit === "true") return;
  boardEl.dataset.gestureInit = "true";
  boardEl.addEventListener("pointerdown", handleTicTacToeBoardPointerDown);
  boardEl.addEventListener("pointermove", handleTicTacToeBoardPointerMove);
  boardEl.addEventListener("pointerup", handleTicTacToeBoardPointerUp);
  boardEl.addEventListener("pointercancel", handleTicTacToeBoardPointerCancel);
  boardEl.addEventListener("click", handleTicTacToeBoardClick);
}

function renderTurnIndicatorSplit(indicatorEl, room, activePlayerId = null, mode = "turn") {
  if (!(indicatorEl instanceof HTMLElement)) return;

  indicatorEl.innerHTML = "";
  indicatorEl.classList.remove("turn-passive");
  if (!activePlayerId) {
    indicatorEl.classList.add("turn-passive");
  }

  const host = room?.players?.host || null;
  const guest = room?.players?.guest || null;
  const sides = [
    { player: host, side: "host", fallback: "Player 1" },
    { player: guest, side: "guest", fallback: "Player 2" }
  ];

  sides.forEach(({ player, side, fallback }) => {
    const pane = document.createElement("div");
    pane.className = `turn-player turn-player-${side}`;

    const theme = player?.theme || (side === "host" ? "red" : "green");
    pane.classList.add(`theme-${theme}`);

    const isActive = Boolean(activePlayerId && player && player.id === activePlayerId);
    pane.classList.add(isActive ? "is-active" : "is-inactive");
    if (!player) pane.classList.add("is-empty");

    const avatar = document.createElement("span");
    avatar.className = "turn-player-avatar";
    avatar.setAttribute("aria-hidden", "true");
    const avatarImg = document.createElement("img");
    avatarImg.src = getPlayerArtSrc(player);
    avatarImg.alt = "";
    avatar.appendChild(avatarImg);

    const meta = document.createElement("span");
    meta.className = "turn-player-meta";
    const name = document.createElement("span");
    name.className = "turn-player-name";
    name.textContent = getDisplayPlayerName(player, fallback);
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
}

function renderTicTacToe(room) {
  const boardEl = document.getElementById("ttt-board");
  const indicatorEl = document.getElementById("turn-indicator");
  const gameSurfaceShell = document.querySelector("#screen-game .game-surface-shell");
  if (!boardEl || !indicatorEl) return;

  const stateGame = getTicTacToeState(room);

  if (!stateGame) {
    clearBoardGestureTracking(boardEl, { preserveSuppression: true });
    boardEl.classList.add("hidden");
    boardEl.classList.remove("game-board-highlight", "game-board-passive", "has-winning-line", "is-finished");
    PLAYER_THEME_CLASS_NAMES.forEach((className) => boardEl.classList.remove(className));
    boardEl.innerHTML = "";
    if (gameSurfaceShell instanceof HTMLElement) {
      gameSurfaceShell.classList.remove("game-shell-highlight");
      PLAYER_THEME_CLASS_NAMES.forEach((className) => gameSurfaceShell.classList.remove(className));
    }
    renderTurnIndicatorSplit(indicatorEl, room, null, "idle");
    return;
  }

  boardEl.classList.remove("hidden");

  const winner = stateGame.winnerId ? playerById(room, stateGame.winnerId) : null;
  const winningLine = Array.isArray(stateGame.winningLine) ? stateGame.winningLine : [];
  const winningIndices = winner && winningLine.length === 3
    ? new Set(winningLine.map((index) => Number(index)).filter((index) => Number.isInteger(index)))
    : null;
  const symbolOwners = new Map();
  Object.entries(stateGame.symbols || {}).forEach(([playerId, symbol]) => {
    const owner = playerById(room, playerId);
    if (owner && symbol) {
      symbolOwners.set(symbol, owner);
    }
  });

  if (winner) {
    renderTurnIndicatorSplit(indicatorEl, room, winner.id, "winner");
  } else if (stateGame.draw) {
    renderTurnIndicatorSplit(indicatorEl, room, null, "draw");
  } else {
    renderTurnIndicatorSplit(indicatorEl, room, stateGame.nextPlayerId || null, "turn");
  }

  const host = room.players?.host || null;
  const guest = room.players?.guest || null;
  const boardThemePlayer = winner
    || (!stateGame.draw ? playerById(room, stateGame.nextPlayerId) : null)
    || host
    || guest
    || null;
  boardEl.classList.remove("game-board-passive");
  boardEl.classList.add("game-board-highlight");
  PLAYER_THEME_CLASS_NAMES.forEach((className) => boardEl.classList.remove(className));
  if (boardThemePlayer?.theme) {
    boardEl.classList.add(`theme-${boardThemePlayer.theme}`);
  } else {
    boardEl.classList.add("game-board-passive");
  }
  if (gameSurfaceShell instanceof HTMLElement) {
    gameSurfaceShell.classList.add("game-shell-highlight");
    PLAYER_THEME_CLASS_NAMES.forEach((className) => gameSurfaceShell.classList.remove(className));
    if (boardThemePlayer?.theme) {
      gameSurfaceShell.classList.add(`theme-${boardThemePlayer.theme}`);
    }
  }
  boardEl.classList.toggle("has-winning-line", Boolean(winningIndices && winningIndices.size === 3));
  boardEl.classList.toggle("is-finished", Boolean(winner || stateGame.draw));

  boardEl.innerHTML = "";
  stateGame.board.forEach((cell, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ttt-cell";
    button.dataset.index = String(index);
    if (winningIndices && winningIndices.has(index)) {
      button.classList.add("is-winning");
      if (winner?.theme) {
        button.classList.add(`theme-${winner.theme}`);
      }
    }
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

    button.disabled = !isTicTacToeCellPlayable(room, index, stateGame);

    boardEl.appendChild(button);
  });

  if (Number.isInteger(state.boardGesture.previewIndex)) {
    const previewIndex = isTicTacToeCellPlayable(room, state.boardGesture.previewIndex, stateGame)
      ? state.boardGesture.previewIndex
      : null;
    setTicTacToePreviewCell(boardEl, previewIndex);
  }
}

function renderPassScreen(room) {
  const passMessage = document.getElementById("pass-message");
  if (!passMessage) return;
  if (!isLocalMode() || !room?.game) {
    passMessage.textContent = "Hand over to the next player, then continue.";
    return;
  }
  passMessage.textContent = state.localPrivacy.prompt || "Hand over to the next player, then continue.";
}

function toBattleshipCoordinate(index, boardSize) {
  const normalizedSize = Number(boardSize) || 6;
  if (!Number.isInteger(index) || index < 0 || index >= normalizedSize * normalizedSize) {
    return "--";
  }
  const col = String.fromCharCode(65 + (index % normalizedSize));
  const row = Math.floor(index / normalizedSize) + 1;
  return `${col}${row}`;
}

function createBattleshipMarker(text, className) {
  const marker = document.createElement("span");
  marker.className = className;
  marker.textContent = text;
  return marker;
}

function renderBattleships(room) {
  const activeGameId = room.game?.id || null;
  const isBattleships = activeGameId === "battleships";
  const battleshipLayout = document.getElementById("battleship-layout");
  const tttBoard = document.getElementById("ttt-board");
  const indicatorEl = document.getElementById("turn-indicator");
  const ownBoardEl = document.getElementById("battleship-own-board");
  const ownCard = document.getElementById("battleship-own-card");
  const ownTitle = document.getElementById("battleship-own-title");
  const phaseLabel = document.getElementById("battleship-phase-label");
  const orientationButton = document.getElementById("battleship-orientation");
  const actionRow = document.getElementById("battleship-action-row");
  const clearTargetButton = document.getElementById("battleship-clear-target");
  const fireTargetButton = document.getElementById("battleship-fire-target");

  if (!battleshipLayout || !ownBoardEl || !ownCard) return;

  if (!room.game || !isBattleships) {
    battleshipLayout.classList.add("hidden");
    ownBoardEl.innerHTML = "";
    state.localBattleshipPendingTargetIndex = null;
    if (actionRow) actionRow.classList.add("hidden");
    if (clearTargetButton instanceof HTMLButtonElement) clearTargetButton.disabled = true;
    if (fireTargetButton instanceof HTMLButtonElement) {
      fireTargetButton.disabled = true;
      fireTargetButton.textContent = "Fire";
    }
    return;
  }

  battleshipLayout.classList.remove("hidden");
  if (tttBoard) tttBoard.classList.add("hidden");

  const gameState = getDisplayStateForRoomGame(room) || room.game.state;
  const fullState = room.game.state;
  const viewerPlayerId = ensureLocalViewer(room);
  const viewer = playerById(room, viewerPlayerId);
  const isViewerTurn = Boolean(fullState.nextPlayerId && fullState.nextPlayerId === viewerPlayerId);
  const isFinished = Boolean(fullState.winnerId || fullState.draw || fullState.phase === "finished");
  const canInteract = isLocalMode() && state.localPrivacy.stage !== "handoff" && !isFinished && isViewerTurn;
  const phase = fullState.phase || gameState.phase || "placement";

  if (state.localBattleshipLastPhase !== phase) {
    state.localBattleshipPendingTargetIndex = null;
    state.localBattleshipLastPhase = phase;
  }
  if (ownTitle) ownTitle.textContent = `${getDisplayPlayerName(viewer, "You")} board`;

  if (phaseLabel) {
    if (gameState.phase === "placement") {
      phaseLabel.textContent = `Placement: place ${fullState.shipsPerPlayer} ships of length ${fullState.shipLength}.`;
    } else if (gameState.phase === "battle") {
      phaseLabel.textContent = "Battle: tap a cell to stage a shot, then confirm Fire.";
    } else {
      phaseLabel.textContent = "Round complete.";
    }
  }

  const canPlace = gameState.phase === "placement" && canInteract;
  const canFirePhase = gameState.phase === "battle" && canInteract;
  if (!canFirePhase) {
    state.localBattleshipPendingTargetIndex = null;
  }
  if (orientationButton instanceof HTMLButtonElement) {
    orientationButton.disabled = !canPlace;
    orientationButton.textContent = `Orientation: ${state.localBattleshipOrientation === "v" ? "Vertical" : "Horizontal"}`;
  }

  if (indicatorEl) {
    if (isFinished) {
      const winner = playerById(room, fullState.winnerId);
      if (winner) {
        renderTurnIndicatorSplit(indicatorEl, room, winner.id, "winner");
      } else {
        renderTurnIndicatorSplit(indicatorEl, room, null, "draw");
      }
    } else {
      renderTurnIndicatorSplit(indicatorEl, room, fullState.nextPlayerId || null, "turn");
    }
  }

  const board = gameState.board || {};
  const shipCells = new Set((board.ships || []).flatMap((ship) => ship.cells || []));
  const incomingHits = new Set(board.incomingHits || []);
  const incomingMisses = new Set(board.incomingMisses || []);
  const outgoingHits = new Set(board.outgoingHits || []);
  const outgoingMisses = new Set(board.outgoingMisses || []);
  const outgoingKnown = new Set([...outgoingHits, ...outgoingMisses]);
  const size = Number(gameState.boardSize) || 6;

  if (!Number.isInteger(state.localBattleshipPendingTargetIndex)) {
    state.localBattleshipPendingTargetIndex = null;
  }
  if (Number.isInteger(state.localBattleshipPendingTargetIndex) && outgoingKnown.has(state.localBattleshipPendingTargetIndex)) {
    state.localBattleshipPendingTargetIndex = null;
  }

  ownCard.classList.remove("game-board-highlight", "is-actionable", ...PLAYER_THEME_CLASS_NAMES);
  ownCard.classList.add("game-board-highlight");
  if (viewer?.theme) ownCard.classList.add(`theme-${viewer.theme}`);
  ownCard.classList.toggle("is-actionable", canPlace || canFirePhase);

  ownBoardEl.innerHTML = "";
  for (let index = 0; index < size * size; index += 1) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "battleship-cell";
    cell.dataset.index = String(index);
    cell.disabled = true;

    const hasShip = shipCells.has(index);
    const hasIncomingHit = incomingHits.has(index);
    const hasIncomingMiss = incomingMisses.has(index);
    const hasOutgoingHit = outgoingHits.has(index);
    const hasOutgoingMiss = outgoingMisses.has(index);
    const hasOutgoingMark = hasOutgoingHit || hasOutgoingMiss;
    const isPendingTarget = state.localBattleshipPendingTargetIndex === index;

    if (hasShip) cell.classList.add("is-ship");
    if (hasIncomingHit) {
      cell.classList.add("is-incoming-hit");
      cell.appendChild(createBattleshipMarker("X", "battleship-marker battleship-marker-incoming battleship-marker-hit"));
    } else if (hasIncomingMiss) {
      cell.classList.add("is-incoming-miss");
      cell.appendChild(createBattleshipMarker("•", "battleship-marker battleship-marker-incoming battleship-marker-miss"));
    }
    if (hasOutgoingHit) {
      cell.classList.add("has-outgoing-hit");
      cell.appendChild(createBattleshipMarker("X", "battleship-marker battleship-marker-outgoing battleship-marker-hit"));
    } else if (hasOutgoingMiss) {
      cell.classList.add("has-outgoing-miss");
      cell.appendChild(createBattleshipMarker("•", "battleship-marker battleship-marker-outgoing battleship-marker-miss"));
    }
    if (isPendingTarget) {
      cell.classList.add("is-pending-target");
    }

    if (canPlace && !hasShip) {
      cell.disabled = false;
      cell.classList.add("is-target");
      cell.addEventListener("click", () => {
        applyLocalMove({
          action: "place_ship",
          index,
          orientation: state.localBattleshipOrientation
        });
      });
    } else if (canFirePhase && !hasOutgoingMark) {
      cell.disabled = false;
      cell.classList.add("is-target");
      cell.addEventListener("click", () => {
        state.localBattleshipPendingTargetIndex = index;
        renderRoom();
      });
    }
    ownBoardEl.appendChild(cell);
  }

  if (actionRow) {
    actionRow.classList.toggle("hidden", gameState.phase !== "battle");
  }
  const pendingIndex = state.localBattleshipPendingTargetIndex;
  const pendingCoordinate = Number.isInteger(pendingIndex) ? toBattleshipCoordinate(pendingIndex, size) : null;
  if (clearTargetButton instanceof HTMLButtonElement) {
    clearTargetButton.disabled = !canFirePhase || !pendingCoordinate;
  }
  if (fireTargetButton instanceof HTMLButtonElement) {
    fireTargetButton.disabled = !canFirePhase || !pendingCoordinate;
    fireTargetButton.textContent = pendingCoordinate ? `Fire at ${pendingCoordinate}` : "Fire";
  }
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
  const nameEl = document.getElementById("wait-name");
  const textEl = document.getElementById("wait-text");
  const picker = playerById(room, room.round?.firstPlayerId || room.round?.pickerId);

  if (!picker) {
    if (nameEl) nameEl.textContent = "Waiting";
    if (textEl) textEl.textContent = "for game choices to resolve.";
    return;
  }

  if (nameEl) nameEl.textContent = getDisplayPlayerName(picker, "Picker");
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
  const panel = document.getElementById("game-result-panel");
  const winnerId = room.game?.state?.winnerId;
  const isDraw = Boolean(room.game?.state?.draw);
  if (!(panel instanceof HTMLElement)) return;
  const winner = winnerId ? playerById(room, winnerId) : null;

  const titleEl = document.getElementById("winner-title");
  const columns = document.getElementById("winner-score-columns");
  const hasEnded = Boolean(winnerId || isDraw);

  panel.classList.toggle("hidden", !hasEnded);
  if (!hasEnded) {
    if (titleEl) {
      titleEl.textContent = "Winner";
    }
    if (columns) {
      columns.innerHTML = "";
    }
    return;
  }

  if (titleEl) {
    titleEl.textContent = isDraw && !winner
      ? "It's a draw"
      : `${getDisplayPlayerName(winner, "Someone")} is the winner`;
  }
  if (columns) {
    columns.innerHTML = "";
    columns.appendChild(
      buildScoreDuelPanel(room.players.host, room.players.guest, leaderId, {
        guestWaiting: !room.players.guest
      })
    );
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
  const requesterName = requester ? getDisplayPlayerName(requester, "Someone") : "Someone";
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

function resolveScreen(room) {
  const finished = room.game?.state?.winnerId || room.game?.state?.draw;
  if (isLocalMode()) {
    if (finished) return "game";
    if (shouldShowLocalPassScreen(room, state.localPrivacy)) return "pass";
    if (room.game && !finished) return "game";
    if (room.round?.status === "waiting_game") return "lobby";
    return "lobby";
  }
  const preferred = getPreferredRoomScreen(room?.code);
  if (room.game) return "game";
  if (room.players.host && room.players.guest && !room.game) return preferred;
  return "lobby";
}

function setup() {
  const joinCodeInput = document.getElementById("join-code");
  const hostPicker = document.getElementById("host-avatar-picker");
  const joinPicker = document.getElementById("join-avatar-picker");
  const localPickerGrid = document.getElementById("local-avatar-grid");
  const localResumeButton = document.getElementById("local-rejoin-room");
  const localClearButton = document.getElementById("local-clear-rejoin");
  const shareRoomLinkButton = document.getElementById("share-room-link");
  const updateHostPicker = () => {
    updateAvatarPicker(hostPicker, state.hostAvatar);
    renderHostSetupCta();
  };
  const updateJoinPicker = () => updateAvatarPicker(joinPicker, state.joinAvatar);
  const updateLocalPickers = () => renderLocalSetup();

  document.getElementById("go-local").addEventListener("click", () => {
    state.mode = "local";
    state.localStep = "p1";
    state.localAvatars = { one: null, two: null };
    state.localHonorifics = { p1: "mr", p2: "mr" };
    state.localBattleshipPendingTargetIndex = null;
    state.localBattleshipLastPhase = null;
    updateLocalPickers();
    showScreen("local", { history: "push" });
  });
  document.getElementById("go-host").addEventListener("click", () => {
    state.mode = "online";
    state.hostHonorific = "mr";
    syncHonorificToggleInputs();
    refreshAvatarPickerLabels();
    refreshStaticPlayerArt();
    renderHostSetupCta();
    showScreen("host", { history: "push" });
  });
  document.getElementById("go-join").addEventListener("click", () => {
    state.mode = "online";
    resetJoinFlow();
    renderJoinSetup();
    showScreen("join", { history: "push" });
  });

  initModeToggle();
  initHonorificToggle();
  resetPatternConfig();
  if (IS_DEV_BUILD) {
    window.multipassPattern = {
      setPatternConfig,
      resetPatternConfig,
      getPatternConfig
    };
  }
  initSettingsModal();
  registerServiceWorker();
  initInstallPromptHandling();
  state.localRejoinSnapshot = loadLocalRejoinSnapshot();

  setupAvatarPicker(hostPicker, (avatarId) => {
    state.hostAvatar = avatarId;
    updateHostPicker();
  });
  setupAvatarPicker(joinPicker, (avatarId) => {
    state.joinAvatar = avatarId;
    if (state.joinStep === "avatar") {
      renderJoinSetup();
    } else {
      updateJoinPicker();
    }
  });
  setupAvatarPicker(localPickerGrid, (avatarId) => {
    if (state.localStep === "p1") {
      state.localAvatars.one = avatarId;
      if (state.localAvatars.two === avatarId) {
        state.localAvatars.two = null;
      }
    } else {
      state.localAvatars.two = avatarId;
    }
    updateLocalPickers();
  });

  const localContinue = document.getElementById("local-continue");
  if (localContinue) {
    localContinue.addEventListener("click", () => {
      const selectedAvatarId = state.localStep === "p1" ? state.localAvatars.one : state.localAvatars.two;
      if (!getAvatar(selectedAvatarId)) {
        showToast("Pick a player first.");
        return;
      }
      if (state.localStep === "p1") {
        state.localStep = "p2";
        updateLocalPickers();
        return;
      }
      startLocalRoomFromSetupSelections();
    });
  }
  updateHostPicker();
  updateJoinPicker();
  updateLocalPickers();
  initJoinCodeCluster();
  renderJoinSetup();
  initTicTacToeBoardGestures();
  initLandingSwipeGestures();
  setLandingMode("local", { animate: false });

  if (landingTabLocal) {
    landingTabLocal.addEventListener("click", () => setLandingMode("local"));
  }
  if (landingTabOnline) {
    landingTabOnline.addEventListener("click", () => setLandingMode("online"));
  }

  document.getElementById("create-room").addEventListener("click", () => {
    state.mode = "online";
    const avatar = getAvatar(state.hostAvatar);
    if (!avatar) {
      showToast("Pick an avatar first.");
      return;
    }
    clearRecentLeaveGuard();
    send({
      type: "create_room",
      avatar: avatar.id,
      honorific: state.hostHonorific,
      clientId: state.clientId
    });
  });

  document.getElementById("join-room").addEventListener("click", () => {
    state.mode = "online";
    const codeInput = document.getElementById("join-code");
    const code = codeInput ? codeInput.value : "";
    if (state.joinStep === "code") {
      beginJoinValidation(code, { source: "manual" });
      return;
    }

    const avatar = getAvatar(state.joinAvatar);
    if (!avatar) {
      showToast("Pick an avatar first.");
      return;
    }
    clearRecentLeaveGuard();
    send({
      type: "join_room",
      code: state.joinValidatedCode || code,
      avatar: avatar.id,
      honorific: state.joinHonorific,
      clientId: state.clientId,
      seatToken: state.seatToken
    });
  });

  if (shareRoomLinkButton) {
    shareRoomLinkButton.addEventListener("click", () => {
      void shareRoomInviteLink();
    });
  }

  if (joinCodeInput) {
    joinCodeInput.addEventListener("input", (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      const code = sanitizeJoinCode(input.value);
      input.value = code;
      setJoinCodeSlots(code);
      clearJoinCodeStatusMessage();
      autoValidateJoinCodeIfReady(code);
    });
  }

  document.getElementById("new-round").addEventListener("click", () => {
    if (isLocalMode()) {
      advanceLocalRoundByAlternation();
      return;
    }
    send({ type: "new_round" });
  });

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
    clearRecentLeaveGuard();
    send({
      type: "join_room",
      code: state.lastRoomCode,
      clientId: state.clientId,
      seatToken: state.seatToken
    });
  });

  const battleshipOrientation = document.getElementById("battleship-orientation");
  if (battleshipOrientation) {
    battleshipOrientation.addEventListener("click", () => {
      state.localBattleshipOrientation = state.localBattleshipOrientation === "h" ? "v" : "h";
      renderRoom();
    });
  }

  const battleshipClearTarget = document.getElementById("battleship-clear-target");
  if (battleshipClearTarget) {
    battleshipClearTarget.addEventListener("click", () => {
      if (!Number.isInteger(state.localBattleshipPendingTargetIndex)) return;
      state.localBattleshipPendingTargetIndex = null;
      renderRoom();
    });
  }

  const battleshipFireTarget = document.getElementById("battleship-fire-target");
  if (battleshipFireTarget) {
    battleshipFireTarget.addEventListener("click", () => {
      if (!Number.isInteger(state.localBattleshipPendingTargetIndex)) return;
      applyLocalMove({
        action: "fire",
        index: state.localBattleshipPendingTargetIndex
      });
    });
  }

  const passReadyButton = document.getElementById("pass-ready");
  if (passReadyButton) {
    passReadyButton.addEventListener("click", () => {
      acknowledgeLocalPassHandoff();
    });
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
  window.__multipassLegacyReady = true;
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
    getAvatar,
    formatAvatarLabel: (avatar) => formatHonorificName(
      avatar?.name || "",
      state.localHonorifics[currentLocalStepKey()]
    ),
    formatLockedAvatarLabel: (avatar) => formatHonorificName(
      avatar?.name || "",
      state.localHonorifics.p1
    ),
    updateAvatarPicker,
    renderLocalSetupCta,
    updateHeroActions
  });
  syncHonorificToggleInputs();
  refreshAvatarPickerLabels();
  refreshStaticPlayerArt();
}

function initSettingsModal() {
  const openButton = document.getElementById("open-settings");
  const closeButton = document.getElementById("close-settings");
  const modal = document.getElementById("settings-modal");
  if (!openButton || !closeButton || !modal) return;

  const closeModal = ({ restoreFocus = true } = {}) => {
    modal.classList.add("hidden");
    if (restoreFocus && state.settingsLastFocus instanceof HTMLElement) {
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

  if (IS_DEV_BUILD) {
    const openDevkitButton = document.getElementById("open-devkit");
    if (openDevkitButton) {
      openDevkitButton.addEventListener("click", () => {
        const fallback = "landing";
        state.devkitReturnScreen = state.activeScreen !== "devkit" && screens[state.activeScreen]
          ? state.activeScreen
          : fallback;
        closeModal({ restoreFocus: false });
        showScreen("devkit", { history: "push" });
      });
    }
  }

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

function getLandingPanelWidthPx() {
  if (landingPanelLocal instanceof HTMLElement && landingPanelOnline instanceof HTMLElement) {
    const localRect = landingPanelLocal.getBoundingClientRect();
    const onlineRect = landingPanelOnline.getBoundingClientRect();
    const step = Math.abs(onlineRect.left - localRect.left);
    if (step > 0) return step;
  }
  if (!(landingTrack instanceof HTMLElement)) return 0;
  const rect = landingTrack.getBoundingClientRect();
  return rect.width > 0 ? rect.width / 2 : 0;
}

function getLandingTrackOffsetPx(mode, panelWidthPx) {
  return mode === "online" ? -panelWidthPx : 0;
}

function getLandingModeProgress(mode) {
  return mode === "online" ? 1 : 0;
}

function applyLandingModeProgress(progress) {
  const normalized = clamp(
    Number.isFinite(progress) ? progress : getLandingModeProgress(state.landingMode),
    0,
    1
  );
  state.landingModeProgress = normalized;
  if (!(landingSegmented instanceof HTMLElement)) return;
  landingSegmented.style.setProperty("--landing-mode-progress", normalized.toFixed(4));
  landingSegmented.style.setProperty(
    "--landing-local-active-pct",
    `${Math.round((1 - normalized) * 100)}%`
  );
  landingSegmented.style.setProperty(
    "--landing-online-active-pct",
    `${Math.round(normalized * 100)}%`
  );
}

function clearLandingGestureTracking(options = {}) {
  const preserveSuppression = Boolean(options.preserveSuppression);
  state.landingGesture.activePointerId = null;
  state.landingGesture.startX = 0;
  state.landingGesture.startY = 0;
  state.landingGesture.lastX = 0;
  state.landingGesture.lastY = 0;
  state.landingGesture.startedAt = 0;
  state.landingGesture.startMode = state.landingMode;
  state.landingGesture.startOffsetPx = 0;
  state.landingGesture.panelWidthPx = 0;
  state.landingGesture.isDragging = false;
  if (!preserveSuppression) {
    state.landingGesture.suppressClickUntil = 0;
  }
  if (landingTrack instanceof HTMLElement) {
    landingTrack.classList.remove("is-dragging");
    landingTrack.style.removeProperty("transform");
  }
}

function handleLandingPointerDown(event) {
  if (!(landingTrack instanceof HTMLElement)) return;
  if (state.activeScreen !== "landing") return;
  if (state.landingGesture.activePointerId !== null) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;

  const panelWidthPx = getLandingPanelWidthPx();
  if (!panelWidthPx) return;

  state.landingGesture.activePointerId = event.pointerId;
  state.landingGesture.startX = event.clientX;
  state.landingGesture.startY = event.clientY;
  state.landingGesture.lastX = event.clientX;
  state.landingGesture.lastY = event.clientY;
  state.landingGesture.startedAt = Date.now();
  state.landingGesture.startMode = state.landingMode;
  state.landingGesture.panelWidthPx = panelWidthPx;
  state.landingGesture.startOffsetPx = getLandingTrackOffsetPx(state.landingMode, panelWidthPx);
  state.landingGesture.isDragging = false;
  applyLandingModeProgress(getLandingModeProgress(state.landingMode));
}

function handleLandingPointerMove(event) {
  if (!(landingTrack instanceof HTMLElement)) return;
  if (state.landingGesture.activePointerId !== event.pointerId) return;

  const deltaX = event.clientX - state.landingGesture.startX;
  const deltaY = event.clientY - state.landingGesture.startY;
  state.landingGesture.lastX = event.clientX;
  state.landingGesture.lastY = event.clientY;

  if (!state.landingGesture.isDragging) {
    if (!hasMetDragActivation(deltaX, deltaY, LANDING_DRAG_ACTIVATION_PX)) return;
    const axis = classifySwipeAxis(deltaX, deltaY);
    if (axis !== "horizontal") {
      clearLandingGestureTracking({ preserveSuppression: true });
      return;
    }
    state.landingGesture.isDragging = true;
    landingTrack.classList.add("is-dragging");
    if (typeof landingTrack.setPointerCapture === "function") {
      try {
        landingTrack.setPointerCapture(event.pointerId);
      } catch (error) {
        // ignore pointer capture failures
      }
    }
  }

  const panelWidthPx = state.landingGesture.panelWidthPx || getLandingPanelWidthPx();
  if (!panelWidthPx) return;
  const nextOffset = clamp(
    state.landingGesture.startOffsetPx + deltaX,
    -panelWidthPx,
    0
  );
  landingTrack.style.transform = `translateX(${nextOffset}px)`;
  applyLandingModeProgress(Math.abs(nextOffset) / panelWidthPx);

  if (event.cancelable) {
    event.preventDefault();
  }
}

function handleLandingPointerUp(event) {
  if (!(landingTrack instanceof HTMLElement)) return;
  if (state.landingGesture.activePointerId !== event.pointerId) return;

  if (state.landingGesture.isDragging) {
    const deltaX = event.clientX - state.landingGesture.startX;
    const elapsedMs = Date.now() - state.landingGesture.startedAt;
    const velocityX = computeSwipeVelocityPxPerMs(deltaX, elapsedMs);
    const panelWidthPx = state.landingGesture.panelWidthPx || getLandingPanelWidthPx();
    const distanceThresholdPx = Math.max(
      LANDING_SWIPE_MIN_DISTANCE_PX,
      panelWidthPx * LANDING_SWIPE_DISTANCE_RATIO
    );
    const nextMode = resolveLandingSnapMode({
      startMode: state.landingGesture.startMode,
      deltaX,
      velocityX,
      distanceThresholdPx,
      velocityThresholdPxPerMs: LANDING_SWIPE_VELOCITY_PX_PER_MS
    });

    if (typeof landingTrack.releasePointerCapture === "function") {
      try {
        if (landingTrack.hasPointerCapture(event.pointerId)) {
          landingTrack.releasePointerCapture(event.pointerId);
        }
      } catch (error) {
        // ignore release failures
      }
    }
    state.landingGesture.suppressClickUntil = Date.now() + BOARD_CLICK_SUPPRESS_MS;
    clearLandingGestureTracking({ preserveSuppression: true });
    setLandingMode(nextMode);
    if (event.cancelable) {
      event.preventDefault();
    }
    return;
  }

  clearLandingGestureTracking({ preserveSuppression: true });
}

function handleLandingPointerCancel(event) {
  if (!(landingTrack instanceof HTMLElement)) return;
  if (state.landingGesture.activePointerId !== event.pointerId) return;

  const fallbackMode = state.landingGesture.startMode || state.landingMode;
  if (typeof landingTrack.releasePointerCapture === "function") {
    try {
      if (landingTrack.hasPointerCapture(event.pointerId)) {
        landingTrack.releasePointerCapture(event.pointerId);
      }
    } catch (error) {
      // ignore release failures
    }
  }
  clearLandingGestureTracking({ preserveSuppression: true });
  setLandingMode(fallbackMode, { animate: false });
}

function handleLandingClickCapture(event) {
  if (!shouldSuppressClick(state.landingGesture.suppressClickUntil, Date.now(), 0)) return;
  event.preventDefault();
  event.stopPropagation();
}

function initLandingSwipeGestures() {
  if (!(landingCarousel instanceof HTMLElement)) return;
  if (landingCarousel.dataset.swipeInit === "true") return;
  landingCarousel.dataset.swipeInit = "true";
  landingCarousel.addEventListener("pointerdown", handleLandingPointerDown);
  landingCarousel.addEventListener("pointermove", handleLandingPointerMove);
  landingCarousel.addEventListener("pointerup", handleLandingPointerUp);
  landingCarousel.addEventListener("pointercancel", handleLandingPointerCancel);
  landingCarousel.addEventListener("click", handleLandingClickCapture, true);
}

function setLandingMode(mode, options = {}) {
  const nextMode = mode === "online" ? "online" : "local";
  const modeChanged = state.landingMode !== nextMode;
  const shouldAnimate = options.animate ?? modeChanged;
  state.landingMode = nextMode;
  if (landingTrack) {
    landingTrack.classList.remove("is-dragging");
    landingTrack.style.removeProperty("transform");
    landingTrack.dataset.mode = nextMode;
  }
  if (landingSegmented) {
    landingSegmented.dataset.mode = nextMode;
  }
  applyLandingModeProgress(getLandingModeProgress(nextMode));
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
  state.joinCodeStatusMessage = "";
  state.joinValidationSource = null;
  state.pendingDeepLinkJoinCode = null;
  state.joinAvatar = null;
  state.joinHonorific = "mr";
  const joinCodeInput = document.getElementById("join-code");
  if (joinCodeInput instanceof HTMLInputElement) {
    joinCodeInput.value = "";
  }
  setJoinCodeSlots("");
}

function beginJoinValidation(rawCode, options = {}) {
  const source = options.source || "manual";
  const code = sanitizeJoinCode(rawCode);
  if (code.length !== JOIN_CODE_LENGTH) {
    state.joinCodeStatusMessage = "Enter 4-letter code";
    const joinCodeInput = document.getElementById("join-code");
    if (joinCodeInput instanceof HTMLInputElement) {
      joinCodeInput.value = code;
    }
    setJoinCodeSlots(code);
    renderJoinSetup();
    if (source === "manual") {
      showToast("Enter a 4-letter room code.");
    }
    return false;
  }

  const joinCodeInput = document.getElementById("join-code");
  if (joinCodeInput instanceof HTMLInputElement) {
    joinCodeInput.value = code;
  }
  setJoinCodeSlots(code);

  state.joinValidating = true;
  state.joinValidatedCode = code;
  state.joinCodeStatusMessage = "Checking room...";
  state.joinValidationSource = source;
  renderJoinSetup();

  const socket = wsClient.getSocket();
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    state.pendingDeepLinkJoinCode = code;
    if (source === "manual") {
      showToast("Connecting...");
    }
    return false;
  }

  state.pendingDeepLinkJoinCode = null;
  send({
    type: "validate_room",
    code,
    clientId: state.clientId,
    seatToken: state.seatToken
  });
  return true;
}

function renderJoinSetup() {
  const joinCode = document.getElementById("join-code");
  const joinButton = document.getElementById("join-room");
  const joinHint = document.getElementById("join-step-hint");
  const joinPicker = document.getElementById("join-avatar-picker");
  const joinHonorificToolbar = document.getElementById("join-honorific-toolbar");
  if (!(joinCode instanceof HTMLInputElement) || !joinButton || !joinHint || !joinPicker) return;

  const isCodeStep = state.joinStep === "code";
  const code = syncJoinCodeSlotsFromCanonical();
  joinCode.disabled = state.joinValidating || !isCodeStep;
  setJoinCodeClusterDisabled(state.joinValidating || !isCodeStep);
  joinPicker.classList.toggle("hidden", isCodeStep);
  if (joinHonorificToolbar) {
    joinHonorificToolbar.classList.toggle("hidden", isCodeStep);
  }
  joinButton.textContent = isCodeStep ? (state.joinValidating ? "Checking..." : "Continue") : "Join room";
  joinButton.disabled = state.joinValidating || (isCodeStep && code.length !== JOIN_CODE_LENGTH);

  if (isCodeStep) {
    joinHint.textContent = state.joinValidating
      ? "Checking room..."
      : (state.joinCodeStatusMessage || "Enter 4-letter code");
    joinPicker.querySelectorAll(".avatar-option").forEach((button) => {
      button.classList.remove("p1-locked");
      button.removeAttribute("aria-disabled");
    });
    syncHonorificToggleInputs();
    refreshAvatarPickerLabels();
    refreshStaticPlayerArt();
    return;
  }

  const hostTheme = state.joinPreview?.host?.theme || null;
  joinHint.textContent = "Pick your player";
  updateAvatarPicker(joinPicker, state.joinAvatar, hostTheme ? [hostTheme] : []);
  joinPicker.querySelectorAll(".avatar-option").forEach((button) => {
    const avatarId = button.dataset.avatar || "";
    button.classList.remove("p1-locked");
    button.removeAttribute("aria-disabled");
    if (hostTheme && avatarId === hostTheme) {
      button.classList.add("p1-locked");
      button.setAttribute("aria-disabled", "true");
    }
  });
  syncHonorificToggleInputs();
  refreshAvatarPickerLabels();
  refreshStaticPlayerArt();
}

function renderHostSetupCta() {
  const hostCta = document.getElementById("create-room");
  if (!(hostCta instanceof HTMLButtonElement)) return;
  const avatar = getAvatar(state.hostAvatar);
  if (!avatar) {
    hostCta.disabled = true;
    hostCta.textContent = "Pick a player";
    return;
  }
  hostCta.disabled = false;
  hostCta.textContent = "Continue";
}

function renderLocalSetupCta() {
  const localCta = document.getElementById("local-continue");
  if (!(localCta instanceof HTMLButtonElement)) return;
  const selectedAvatarId = state.localStep === "p1" ? state.localAvatars.one : state.localAvatars.two;
  const avatar = getAvatar(selectedAvatarId);
  if (!avatar) {
    localCta.disabled = true;
    localCta.textContent = "Pick a player";
    return;
  }
  localCta.disabled = false;
  localCta.textContent = "Continue";
}

function startLocalRoomFromSetupSelections() {
  const avatarOne = getAvatar(state.localAvatars.one);
  const avatarTwo = getAvatar(state.localAvatars.two);
  if (!avatarOne || !avatarTwo) {
    showToast("Pick a player first.");
    return false;
  }
  state.mode = "local";
  state.room = createLocalRoom(
    avatarOne,
    avatarTwo,
    state.localHonorifics.p1,
    state.localHonorifics.p2
  );
  state.you = { playerId: state.room.players.host.id, role: "local" };
  state.lastWinSignature = null;
  state.lastLeaderId = null;
  resetLocalPrivacy(state.room);
  state.localBattleshipOrientation = "h";
  state.localBattleshipPendingTargetIndex = null;
  state.localBattleshipLastPhase = null;
  state.localStep = "p1";
  saveLocalRejoinSnapshot(state.room);
  updateLocalRejoinCard();
  renderRoom();
  showScreen("lobby", { history: "push" });
  return true;
}
