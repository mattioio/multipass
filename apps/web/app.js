const state = {
  ws: null,
  clientId: localStorage.getItem("multipass_client_id"),
  room: null,
  you: null,
  mode: "online",
  activeScreen: "landing",
  keepPickOpen: false,
  lastScreen: localStorage.getItem("multipass_last_screen"),
  lastRoomCode: localStorage.getItem("multipass_last_room"),
  autoJoinCode: null,
  lastShuffleAt: null,
  shuffleTimer: null,
  shuffleInterval: null,
  lastLeaderId: null,
  lastWinSignature: null,
  shuffleEmojis: ["🍌", "🍓", "🥝", "🫐", "🍉", "🍋", "🍊", "🍒", "🥑", "🍍"],
  hostFruit: null,
  joinFruit: null,
  localFruits: { one: null, two: null }
};

const FRUITS = {
  banana: { id: "banana", name: "Banana", emoji: "🍌", theme: "banana" },
  strawberry: { id: "strawberry", name: "Strawberry", emoji: "🍓", theme: "strawberry" },
  kiwi: { id: "kiwi", name: "Kiwi", emoji: "🥝", theme: "kiwi" },
  blueberry: { id: "blueberry", name: "Blueberry", emoji: "🫐", theme: "blueberry" }
};

function getFruit(id) {
  return FRUITS[id] || null;
}

function setupFruitPicker(container, onSelect) {
  if (!container) return;
  container.addEventListener("click", (event) => {
    const button = event.target.closest(".fruit-option");
    if (!button || button.disabled) return;
    const fruitId = button.dataset.fruit;
    if (!fruitId) return;
    onSelect(fruitId);
  });
}

function updateFruitPicker(container, selectedId, disabledIds = []) {
  if (!container) return;
  container.querySelectorAll(".fruit-option").forEach((button) => {
    const fruitId = button.dataset.fruit;
    const isSelected = fruitId === selectedId;
    const isDisabled = disabledIds.includes(fruitId);
    button.classList.toggle("selected", isSelected);
    button.disabled = isDisabled;
  });
}

const localGames = {
  tic_tac_toe: {
    id: "tic_tac_toe",
    name: "Tic Tac Toe",
    minPlayers: 2,
    maxPlayers: 2,
    init(players) {
      const [p1, p2] = players;
      const symbols = {
        [p1.id]: "X",
        [p2.id]: "O"
      };

      return {
        board: Array(9).fill(null),
        playerOrder: [p1.id, p2.id],
        symbols,
        nextPlayerId: p1.id,
        winnerId: null,
        draw: false,
        history: []
      };
    },
    applyMove(state, move, playerId) {
      if (state.winnerId || state.draw) {
        return { error: "Game is already finished." };
      }

      if (playerId !== state.nextPlayerId) {
        return { error: "Not your turn." };
      }

      const index = Number(move?.index);
      if (!Number.isInteger(index) || index < 0 || index > 8) {
        return { error: "Invalid move." };
      }

      if (state.board[index] !== null) {
        return { error: "That space is already taken." };
      }

      const board = state.board.slice();
      board[index] = state.symbols[playerId];

      const winnerId = getWinnerId(board, state.symbols);
      const draw = !winnerId && board.every((cell) => cell !== null);
      const nextPlayerId = winnerId || draw
        ? null
        : (playerId === state.playerOrder[0] ? state.playerOrder[1] : state.playerOrder[0]);

      return {
        state: {
          ...state,
          board,
          winnerId,
          draw,
          nextPlayerId,
          history: [...state.history, { playerId, index }]
        }
      };
    }
  }
};

const TTT_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

function getWinnerId(board, symbols) {
  for (const [a, b, c] of TTT_LINES) {
    const val = board[a];
    if (!val) continue;
    if (val === board[b] && val === board[c]) {
      const entry = Object.entries(symbols).find(([, symbol]) => symbol === val);
      if (entry) return entry[0];
    }
  }
  return null;
}

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

const toastEl = document.getElementById("toast");
const actionToastEl = document.getElementById("action-toast");
const actionToastText = document.getElementById("action-toast-text");
const actionToastCta = document.getElementById("action-toast-cta");

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => toastEl.classList.add("hidden"), 2400);
}

function showActionToast(message, ctaLabel, onClick) {
  if (!actionToastEl || !actionToastText || !actionToastCta) return;
  actionToastText.textContent = message;
  actionToastCta.textContent = ctaLabel;
  actionToastCta.onclick = onClick;
  actionToastEl.classList.remove("hidden");
}

function hideActionToast() {
  if (!actionToastEl || !actionToastCta) return;
  actionToastEl.classList.add("hidden");
  actionToastCta.onclick = null;
  actionToastCta.disabled = false;
}

function applyMode(mode, persist = false) {
  document.body.dataset.mode = mode;
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

function showScreen(key) {
  state.activeScreen = key;
  localStorage.setItem("multipass_last_screen", key);
  Object.entries(screens).forEach(([name, element]) => {
    element.classList.toggle("active", name === key);
  });
  const heroRoom = document.getElementById("hero-room");
  if (heroRoom) {
    heroRoom.classList.toggle("hidden", key === "game" || !state.room?.code);
  }
}

function getWebSocketUrl() {
  const override = window.localStorage?.getItem("multipass_ws_url");
  if (override) return override;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.host}`;
  }
  return "wss://api.loreandorder.com";
}

function connect() {
  state.ws = new WebSocket(getWebSocketUrl());

  state.ws.addEventListener("open", () => {
    if (state.lastRoomCode && state.mode === "online") {
      state.autoJoinCode = state.lastRoomCode;
      send({
        type: "join_room",
        code: state.lastRoomCode,
        clientId: state.clientId
      });
    }
  });

  state.ws.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (err) {
      return;
    }

    if (message.type === "session") {
      state.clientId = message.clientId;
      localStorage.setItem("multipass_client_id", message.clientId);
      return;
    }

    if (message.type === "room_state") {
      if (state.mode === "local") {
        return;
      }
      state.room = message.room;
      state.you = message.you;
      state.autoJoinCode = null;
      const shouldShuffle =
        state.room?.round?.status === "shuffling" &&
        state.room?.round?.shuffleAt &&
        state.room.round.shuffleAt !== state.lastShuffleAt;
      if (state.room?.code) {
        state.lastRoomCode = state.room.code;
        localStorage.setItem("multipass_last_room", state.room.code);
      }
      updateRejoinCard();
      renderRoom();
      const endSignature = getEndSignature(state.room);
      if (endSignature && endSignature !== state.lastWinSignature) {
        state.lastWinSignature = endSignature;
        showScreen("winner");
        return;
      }
      if (shouldShuffle) {
        showScreen("shuffle");
        return;
      }
      const nextScreen = resolveScreen(state.room);
      showScreen(nextScreen);
      return;
    }

    if (message.type === "error") {
      if (state.autoJoinCode) {
        if (message.message === "Room not found.") {
          state.autoJoinCode = null;
          state.lastRoomCode = null;
          localStorage.removeItem("multipass_last_room");
          updateRejoinCard();
          showToast("Room expired.");
          showScreen("landing");
          return;
        }
        if (message.message === "Pick a fruit.") {
          state.autoJoinCode = null;
          const joinCodeInput = document.getElementById("join-code");
          if (joinCodeInput && state.lastRoomCode) {
            joinCodeInput.value = state.lastRoomCode;
          }
          showToast("Pick a fruit to rejoin.");
          showScreen("join");
          return;
        }
      }
      showToast(message.message || "Something went wrong.");
      return;
    }
  });

  state.ws.addEventListener("close", () => {
    showToast("Disconnected. Refresh to reconnect.");
  });
}

function send(payload) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    showToast("Connecting...");
    return;
  }
  state.ws.send(JSON.stringify(payload));
}

function playerById(room, id) {
  if (!id || !room) return null;
  const list = [room.players.host, room.players.guest].filter(Boolean);
  return list.find((entry) => entry.id === id) || null;
}

function isLocalMode() {
  return state.mode === "local";
}

function localId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function listLocalGames() {
  return Object.values(localGames).map((game) => ({
    id: game.id,
    name: game.name,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers
  }));
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
      status: "waiting"
    },
    game: null,
    games: listLocalGames()
  };
}

function startLocalShuffle() {
  if (!state.room) return;
  const players = [state.room.players.host, state.room.players.guest].filter(Boolean);
  if (players.length < 2) return;
  const picker = players[Math.floor(Math.random() * players.length)];
  state.room.round = {
    pickerId: picker.id,
    firstPlayerId: picker.id,
    shuffleAt: Date.now(),
    status: "shuffling"
  };
  state.room.updatedAt = Date.now();
  handleLocalUpdate();
}

function handleLocalUpdate() {
  renderRoom();
  const endSignature = getEndSignature(state.room);
  if (endSignature && endSignature !== state.lastWinSignature) {
    state.lastWinSignature = endSignature;
    showScreen("winner");
    return;
  }
  showScreen(resolveScreen(state.room));
}

function startLocalGame(gameId) {
  const game = localGames[gameId];
  if (!game || !state.room) return;
  const players = [state.room.players.host, state.room.players.guest].filter(Boolean);
  state.room.game = {
    id: game.id,
    name: game.name,
    state: game.init(players)
  };
  if (state.room.round) {
    state.room.round.status = "playing";
  }
  state.room.updatedAt = Date.now();
  handleLocalUpdate();
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

function leaveRoom() {
  if (isLocalMode()) {
    state.mode = "online";
    state.room = null;
    state.you = null;
    state.lastLeaderId = null;
    state.lastWinSignature = null;
    document.body.removeAttribute("data-theme");
    showScreen("landing");
    return;
  }

  if (state.room?.code) {
    state.lastRoomCode = state.room.code;
    localStorage.setItem("multipass_last_room", state.room.code);
  }
  updateRejoinCard();

  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify({ type: "leave_room" }));
  }

  state.room = null;
  state.you = null;
  state.autoJoinCode = null;
  document.body.removeAttribute("data-theme");
  showScreen("landing");
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
  if (heroRoom) heroRoom.classList.toggle("hidden", !room.code);
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
    cta.textContent = "Waiting for a second player...";
    cta.dataset.action = "none";
    if (endGameButton) endGameButton.classList.add("hidden");
    return;
  }

  const me = playerById(room, state.you?.playerId);
  const meReady = Boolean(me?.ready);
  const bothReady = isBothReady(room);
  const hasPicker = Boolean(room.round?.pickerId);
  const isPicker = isCurrentPicker(room);
  const gameActive = Boolean(room.game && !room.game.state?.winnerId && !room.game.state?.draw);

  if (endGameButton) {
    if (!isLocalMode() && gameActive) {
      endGameButton.classList.remove("hidden");
      endGameButton.disabled = Boolean(room.endRequest);
    } else {
      endGameButton.classList.add("hidden");
    }
  }

  if (!meReady) {
    cta.disabled = false;
    cta.textContent = "Ready up";
    cta.dataset.action = "ready";
    return;
  }

  if (!bothReady) {
    cta.disabled = true;
    cta.textContent = "Waiting for other player...";
    cta.dataset.action = "none";
    return;
  }

  if (!hasPicker) {
    cta.disabled = false;
    cta.textContent = "Start";
    cta.dataset.action = "start";
    return;
  }

  if (isPicker) {
    cta.disabled = false;
    cta.textContent = "Pick a game";
    cta.dataset.action = "pick";
    return;
  }

  cta.disabled = true;
  cta.textContent = "Waiting for picker...";
  cta.dataset.action = "none";
}

function renderScoreboard(room, leaderId) {
  const columns = document.getElementById("score-columns");
  if (!columns) return;
  columns.innerHTML = "";

  const host = room.players.host;
  const guest = room.players.guest;

  columns.appendChild(buildScoreColumn(host, "Host", leaderId, { showReadyBadge: true, showLeave: true }));
  columns.appendChild(buildScoreColumn(guest, "Guest", leaderId, { showReadyBadge: true, showLeave: true }));
}

function getLeaderId(players) {
  const list = players.filter(Boolean);
  if (list.length === 0) return null;
  if (list.length === 1) return list[0].id;

  const [a, b] = list;
  const winsA = a.gamesWon ?? 0;
  const winsB = b.gamesWon ?? 0;
  if (winsA > winsB) return a.id;
  if (winsB > winsA) return b.id;
  return null;
}

function buildScoreColumn(player, label, leaderId, options = {}) {
  const column = document.createElement("div");
  column.className = "score-column";
  const showReadyBadge = options.showReadyBadge !== false;
  const showLeave = options.showLeave === true;
  const theme = player?.theme || (label === "Host" ? "strawberry" : "kiwi");
  column.classList.add(`theme-${theme}`);
  if (player && leaderId && player.id === leaderId) {
    column.classList.add("leader");
  }
  if (showReadyBadge) {
    column.classList.toggle("is-ready", Boolean(player?.ready));
  }

  const top = document.createElement("div");
  top.className = "score-top";

  const emoji = document.createElement("div");
  emoji.className = "score-emoji";
  emoji.textContent = displayEmoji(player);

  const crown = document.createElement("span");
  crown.className = "score-crown";
  crown.textContent = "👑";
  emoji.appendChild(crown);

  const info = document.createElement("div");
  const name = document.createElement("div");
  name.className = "score-name";
  name.textContent = player ? player.name : `${label} (waiting)`;
  const role = document.createElement("div");
  role.className = "score-role";
  role.textContent = label;
  info.appendChild(name);
  info.appendChild(role);

  top.appendChild(emoji);
  top.appendChild(info);

  const stats = document.createElement("div");
  stats.className = "score-stats";

  stats.appendChild(buildStatRow("Games won", player ? player.gamesWon : "--"));

  column.appendChild(top);
  column.appendChild(stats);

  if (showReadyBadge) {
    const readyBadge = document.createElement("div");
    readyBadge.className = "ready-badge";
    readyBadge.textContent = "✓";
    column.appendChild(readyBadge);
  }

  if (showLeave && player && !isLocalMode() && player.id === state.you?.playerId) {
    const leaveRow = document.createElement("div");
    leaveRow.className = "leave-row";
    const leaveButton = document.createElement("button");
    leaveButton.type = "button";
    leaveButton.className = "ghost leave-button";
    leaveButton.dataset.action = "leave-room";
    leaveButton.textContent = "Leave room";
    leaveRow.appendChild(leaveButton);
    column.appendChild(leaveRow);
  }

  return column;
}

function buildStatRow(label, value) {
  const row = document.createElement("div");
  row.className = "stat-row";

  const labelEl = document.createElement("div");
  labelEl.className = "stat-label";
  labelEl.textContent = label;

  const valueEl = document.createElement("div");
  valueEl.className = "stat-value";
  valueEl.textContent = value;

  row.appendChild(labelEl);
  row.appendChild(valueEl);
  return row;
}

function renderGameList(room) {
  const list = document.getElementById("game-list");
  list.innerHTML = "";

  const canPick = isLocalMode()
    ? Boolean(room.round?.pickerId)
    : (isCurrentPicker(room) && Boolean(room.round?.pickerId));
  room.games.forEach((game) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "game-card";
    button.textContent = game.name;
    if (room.game?.id === game.id) {
      button.classList.add("active");
    }
    button.disabled = !canPick;
    button.addEventListener("click", () => {
      state.keepPickOpen = false;
      if (isLocalMode()) {
        startLocalGame(game.id);
        return;
      }
      send({ type: "select_game", gameId: game.id });
    });
    list.appendChild(button);
  });

  const newRound = document.getElementById("new-round");
  const finished = room.game?.state?.winnerId || room.game?.state?.draw;
  if (isLocalMode()) {
    newRound.classList.add("hidden");
  } else if (finished && canPick && isBothReady(room)) {
    newRound.classList.remove("hidden");
  } else {
    newRound.classList.add("hidden");
  }
}

function renderTicTacToe(room) {
  const boardEl = document.getElementById("ttt-board");
  const emojiEl = document.getElementById("turn-emoji");
  const textEl = document.getElementById("turn-text");
  const indicatorEl = document.getElementById("turn-indicator");
  const isLocal = isLocalMode();

  if (!room.game || room.game.id !== "tic_tac_toe") {
    boardEl.innerHTML = "";
    if (emojiEl) emojiEl.textContent = "🎲";
    if (textEl) textEl.textContent = room.game ? "Switch to Tic Tac Toe to play." : "Pick a game to start";
    if (indicatorEl) {
      indicatorEl.classList.remove(
        "turn-active",
        "turn-passive",
        "theme-strawberry",
        "theme-kiwi",
        "theme-banana",
        "theme-blueberry"
      );
      indicatorEl.classList.add("turn-passive");
    }
    return;
  }

  const stateGame = room.game.state;
  const winner = stateGame.winnerId ? playerById(room, stateGame.winnerId) : null;

  if (winner) {
    if (emojiEl) emojiEl.textContent = displayEmoji(winner);
    if (textEl) textEl.textContent = `${winner.name} wins this round`;
    if (indicatorEl) {
      indicatorEl.classList.remove(
        "turn-active",
        "turn-passive",
        "theme-strawberry",
        "theme-kiwi",
        "theme-banana",
        "theme-blueberry"
      );
      indicatorEl.classList.add("turn-passive");
    }
  } else if (stateGame.draw) {
    if (emojiEl) emojiEl.textContent = "🤝";
    if (textEl) textEl.textContent = "Draw game";
    if (indicatorEl) {
      indicatorEl.classList.remove(
        "turn-active",
        "turn-passive",
        "theme-strawberry",
        "theme-kiwi",
        "theme-banana",
        "theme-blueberry"
      );
      indicatorEl.classList.add("turn-passive");
    }
  } else {
    const current = playerById(room, stateGame.nextPlayerId);
    const isYourTurn = !isLocal && current && state.you?.playerId === current.id;
    if (emojiEl) emojiEl.textContent = current ? displayEmoji(current) : "⏳";
    if (textEl) {
      if (isYourTurn) {
        textEl.textContent = "Your turn";
      } else {
        textEl.textContent = current ? `${current.name}'s turn` : "Waiting...";
      }
    }
    if (indicatorEl) {
      indicatorEl.classList.remove(
        "turn-active",
        "turn-passive",
        "theme-strawberry",
        "theme-kiwi",
        "theme-banana",
        "theme-blueberry"
      );
      if (isYourTurn || isLocal) {
        indicatorEl.classList.add("turn-active");
        if (current?.theme) indicatorEl.classList.add(`theme-${current.theme}`);
      } else {
        indicatorEl.classList.add("turn-passive");
      }
    }
  }

  boardEl.innerHTML = "";
  stateGame.board.forEach((cell, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ttt-cell";
    button.textContent = cell || "";

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
  const hint = document.getElementById("pick-hint");
  if (!hint) return;
  if (isLocalMode()) {
    const picker = playerById(room, room.round?.pickerId);
    hint.textContent = picker ? `${picker.name} is picking the next game.` : "Choosing who picks next...";
    return;
  }
  const picker = playerById(room, room.round?.pickerId);
  if (!isBothReady(room)) {
    hint.textContent = "Both players must ready up to start.";
    return;
  }
  if (!picker) {
    hint.textContent = "Waiting for the picker draw...";
    return;
  }
  if (picker.id === state.you?.playerId) {
    hint.textContent = "You're up! Choose the next game.";
  } else {
    hint.textContent = `${picker.name} is picking the next game.`;
  }
}

function renderWaitScreen(room) {
  const emojiEl = document.getElementById("wait-emoji");
  const nameEl = document.getElementById("wait-name");
  const textEl = document.getElementById("wait-text");
  const picker = playerById(room, room.round?.pickerId);

  if (!picker) {
    if (emojiEl) emojiEl.textContent = "🎲";
    if (nameEl) nameEl.textContent = "Waiting";
    if (textEl) textEl.textContent = "for a picker to be chosen.";
    return;
  }

  if (emojiEl) emojiEl.textContent = displayEmoji(picker);
  if (nameEl) nameEl.textContent = picker.name;
  if (textEl) textEl.textContent = "is choosing the next game.";
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
    columns.appendChild(buildScoreColumn(room.players.host, "Host", leaderId, { showReadyBadge: false }));
    columns.appendChild(buildScoreColumn(room.players.guest, "Guest", leaderId, { showReadyBadge: false }));
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
  const display = document.getElementById("shuffle-display");
  if (!display) return;

  const playerEmoji = document.getElementById("shuffle-player-emoji");
  const playerName = document.getElementById("shuffle-player-name");
  const status = room.round?.status;

  if (status !== "shuffling") {
    if (room.round?.shuffleAt) {
      state.lastShuffleAt = room.round.shuffleAt;
    }
    return;
  }

  const bothReady = isBothReady(room);
  if (!bothReady) {
    display.classList.remove("shuffling");
    if (playerEmoji) playerEmoji.textContent = "🎲";
    if (playerName) playerName.textContent = "Waiting...";
    return;
  }

  const shuffleAt = room.round?.shuffleAt;
  if (shuffleAt && shuffleAt !== state.lastShuffleAt) {
    showScreen("shuffle");
    startShuffleAnimation(room);
    return;
  }

  const picker = playerById(room, room.round?.pickerId);
  if (playerEmoji) playerEmoji.textContent = picker ? displayEmoji(picker) : "🎲";
  if (playerName) playerName.textContent = picker ? picker.name : "Picking...";
}

function startShuffleAnimation(room) {
  const display = document.getElementById("shuffle-display");
  const playerEmoji = document.getElementById("shuffle-player-emoji");
  const playerName = document.getElementById("shuffle-player-name");

  if (!display) return;
  display.classList.add("shuffling");
  if (playerName) playerName.textContent = "Shuffling...";

  clearInterval(state.shuffleInterval);
  clearTimeout(state.shuffleTimer);

  const options = [room.players.host, room.players.guest].filter(Boolean).map((player) => displayEmoji(player));
  const pool = options.length ? options : state.shuffleEmojis;
  state.shuffleInterval = setInterval(() => {
    if (playerEmoji) playerEmoji.textContent = pool[Math.floor(Math.random() * pool.length)];
  }, 80);

  state.shuffleTimer = setTimeout(() => {
    clearInterval(state.shuffleInterval);
    display.classList.remove("shuffling");
    const picker = playerById(room, room.round?.pickerId);
    if (playerEmoji) playerEmoji.textContent = picker ? displayEmoji(picker) : "🎲";
    if (playerName) playerName.textContent = picker ? picker.name : "Picking...";
    state.lastShuffleAt = room.round?.shuffleAt || null;
    const next = isCurrentPicker(room) ? "pick" : "wait";
    showScreen(next);
  }, 1200);
}

function isBothReady(room) {
  if (!room) return false;
  if (isLocalMode()) return true;
  return Boolean(room.players.host?.ready && room.players.guest?.ready);
}

function isCurrentPicker(room) {
  if (isLocalMode()) return true;
  if (!room.round?.pickerId || !state.you?.playerId) return false;
  return room.round.pickerId === state.you.playerId;
}

function resolveScreen(room) {
  const stored = localStorage.getItem("multipass_last_screen");
  const canPick = isCurrentPicker(room) && Boolean(room.round?.pickerId);
  const finished = room.game?.state?.winnerId || room.game?.state?.draw;
  if (isLocalMode()) {
    if (room.round?.status === "shuffling") return "shuffle";
    if (room.game) return "game";
    return "pick";
  }
  if (room.game && !finished) return "game";
  if (stored === "winner" && room.game?.state?.winnerId) return "winner";
  if (stored === "pick" && canPick) return "pick";
  if (room.round?.pickerId && !canPick && !room.game) return "wait";
  if (stored === "lobby") return "lobby";
  return room.game ? "game" : "lobby";
}

function setup() {
  const codePill = document.getElementById("room-code-pill");
  const joinCodeInput = document.getElementById("join-code");
  const hostPicker = document.getElementById("host-fruit-picker");
  const joinPicker = document.getElementById("join-fruit-picker");
  const localPickerOne = document.getElementById("local-fruit-one");
  const localPickerTwo = document.getElementById("local-fruit-two");

  initModeToggle();

  const updateHostPicker = () => updateFruitPicker(hostPicker, state.hostFruit);
  const updateJoinPicker = () => updateFruitPicker(joinPicker, state.joinFruit);
  const updateLocalPickers = () => {
    updateFruitPicker(localPickerOne, state.localFruits.one, state.localFruits.two ? [state.localFruits.two] : []);
    updateFruitPicker(localPickerTwo, state.localFruits.two, state.localFruits.one ? [state.localFruits.one] : []);
  };

  setupFruitPicker(hostPicker, (fruitId) => {
    state.hostFruit = fruitId;
    updateHostPicker();
  });
  setupFruitPicker(joinPicker, (fruitId) => {
    state.joinFruit = fruitId;
    updateJoinPicker();
  });
  setupFruitPicker(localPickerOne, (fruitId) => {
    state.localFruits.one = fruitId;
    updateLocalPickers();
  });
  setupFruitPicker(localPickerTwo, (fruitId) => {
    state.localFruits.two = fruitId;
    updateLocalPickers();
  });
  updateHostPicker();
  updateJoinPicker();
  updateLocalPickers();

  document.getElementById("go-local").addEventListener("click", () => {
    state.mode = "local";
    showScreen("local");
  });
  document.getElementById("go-host").addEventListener("click", () => {
    state.mode = "online";
    showScreen("host");
  });
  document.getElementById("go-join").addEventListener("click", () => {
    state.mode = "online";
    showScreen("join");
  });
  document.querySelectorAll("[data-screen]").forEach((button) => {
    button.addEventListener("click", () => showScreen(button.dataset.screen));
  });

  document.getElementById("back-to-lobby").addEventListener("click", () => {
    state.keepPickOpen = false;
    if (isLocalMode()) {
      showScreen("local");
      return;
    }
    showScreen("lobby");
  });

  document.getElementById("back-to-pick").addEventListener("click", () => {
    if (isLocalMode()) {
      startLocalShuffle();
      return;
    }
    if (!isBothReady(state.room)) {
      showToast("Both players need to ready up first.");
      showScreen("lobby");
      return;
    }
    if (!isCurrentPicker(state.room)) {
      showToast("Waiting for the picker.");
      return;
    }
    state.keepPickOpen = true;
    showScreen("pick");
  });

  if (codePill) {
    const copyHandler = () => {
      if (!state.room?.code) return;
      const code = state.room.code;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(code).then(
          () => showToast("Room code copied."),
          () => showToast("Copy failed.")
        );
        return;
      }
      const temp = document.createElement("input");
      temp.value = code;
      document.body.appendChild(temp);
      temp.select();
      try {
        document.execCommand("copy");
        showToast("Room code copied.");
      } catch (err) {
        showToast("Copy failed.");
      }
      document.body.removeChild(temp);
    };

    codePill.addEventListener("click", copyHandler);
    codePill.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        copyHandler();
      }
    });
  }

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
    const code = document.getElementById("join-code").value.trim().toUpperCase();
    const fruit = getFruit(state.joinFruit);
    if (!code || code.length !== 4) {
      showToast("Enter a 4-letter room code.");
      return;
    }
    if (!fruit) {
      showToast("Pick a fruit first.");
      return;
    }
    send({
      type: "join_room",
      code,
      fruit: fruit.id,
      clientId: state.clientId
    });
  });

  if (joinCodeInput) {
    joinCodeInput.addEventListener("input", (event) => {
      event.target.value = event.target.value.toUpperCase();
    });
  }

  document.getElementById("new-round").addEventListener("click", () => {
    if (isLocalMode()) {
      if (state.room?.game) {
        startLocalGame(state.room.game.id);
      }
      return;
    }
    send({ type: "new_round" });
  });

  const endGameButton = document.getElementById("end-game");
  if (endGameButton) {
    endGameButton.addEventListener("click", () => {
      if (!state.room || !state.room.game) return;
      if (isLocalMode()) {
        state.room.game = null;
        state.room.updatedAt = Date.now();
        handleLocalUpdate();
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
        state.room.game = null;
        state.room.updatedAt = Date.now();
        handleLocalUpdate();
        return;
      }
      send({ type: "end_game_request" });
    });
  }

  const winnerAgain = document.getElementById("winner-play-again");
  if (winnerAgain) {
    winnerAgain.addEventListener("click", () => {
      if (isLocalMode()) {
        startLocalShuffle();
        return;
      }
      showScreen("lobby");
    });
  }

  const winnerHome = document.getElementById("winner-home");
  if (winnerHome) {
    winnerHome.addEventListener("click", () => {
      leaveRoom();
    });
  }

  const readyCta = document.getElementById("ready-cta");
  if (readyCta) {
    readyCta.addEventListener("click", () => {
      if (!state.room) return;
      if (isLocalMode()) {
        showScreen("pick");
        return;
      }
      const action = readyCta.dataset.action;
      if (action === "ready") {
        send({ type: "ready_up", ready: true });
      } else if (action === "start") {
        send({ type: "start_round" });
      } else if (action === "pick") {
        state.keepPickOpen = true;
        showScreen("pick");
      }
    });
  }

  document.getElementById("start-local").addEventListener("click", () => {
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
    handleLocalUpdate();
    startLocalShuffle();
  });

  document.getElementById("rejoin-room").addEventListener("click", () => {
    if (!state.lastRoomCode) return;
    state.mode = "online";
    state.autoJoinCode = state.lastRoomCode;
    send({
      type: "join_room",
      code: state.lastRoomCode,
      clientId: state.clientId
    });
  });

  document.getElementById("clear-rejoin").addEventListener("click", () => {
    state.lastRoomCode = null;
    localStorage.removeItem("multipass_last_room");
    updateRejoinCard();
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.action === "leave-room") {
      leaveRoom();
    }
  });

  updateRejoinCard();
  connect();
}

setup();

function updateRejoinCard() {
  const card = document.getElementById("rejoin-card");
  const codeEl = document.getElementById("rejoin-code");
  if (!card || !codeEl) return;
  if (state.lastRoomCode) {
    codeEl.textContent = state.lastRoomCode;
    card.classList.remove("hidden");
  } else {
    card.classList.add("hidden");
  }
}
