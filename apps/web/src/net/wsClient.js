function parseMessage(raw) {
  try {
    return JSON.parse(raw.toString());
  } catch {
    return null;
  }
}

export function createWsClient({ getUrl }) {
  let socket = null;
  const listeners = new Map();

  function emit(event, payload) {
    const set = listeners.get(event);
    if (!set) return;
    for (const cb of set) cb(payload);
  }

  function connect() {
    socket = new WebSocket(getUrl());
    socket.addEventListener("open", () => emit("open", undefined));
    socket.addEventListener("close", (event) => emit("close", event));
    socket.addEventListener("error", (event) => emit("error", event));
    socket.addEventListener("message", (event) => {
      const message = parseMessage(event.data);
      if (!message) return;
      emit("message", message);
    });
    return socket;
  }

  function send(typeOrPayload, payload = {}) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    const outbound = typeof typeOrPayload === "string"
      ? { type: typeOrPayload, ...payload }
      : typeOrPayload;
    socket.send(JSON.stringify(outbound));
    return true;
  }

  function subscribe(event, callback) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(callback);
    return () => {
      listeners.get(event)?.delete(callback);
    };
  }

  function disconnect() {
    socket?.close();
  }

  function getSocket() {
    return socket;
  }

  return {
    connect,
    disconnect,
    send,
    subscribe,
    getSocket
  };
}
