function safeMeta(meta) {
  if (!meta || typeof meta !== "object") return undefined;
  const result = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined) continue;
    result[key] = value;
  }
  return Object.keys(result).length ? result : undefined;
}

function write(level, event, meta) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(safeMeta(meta) ? { meta: safeMeta(meta) } : {})
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function createLogger(scope = "app") {
  const withScope = (meta = {}) => ({ scope, ...meta });

  return {
    info(event, meta) {
      write("info", event, withScope(meta));
    },
    warn(event, meta) {
      write("warn", event, withScope(meta));
    },
    error(event, meta) {
      write("error", event, withScope(meta));
    },
    child(childScope) {
      return createLogger(`${scope}.${childScope}`);
    }
  };
}
