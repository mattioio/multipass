import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

/**
 * Creates a room store backed by SQLite.
 * Drop-in replacement for the in-memory createRoomStore().
 *
 * @param {{ dbPath?: string }} options
 */
export function createSqliteRoomStore(options = {}) {
  const dbPath = options.dbPath || path.resolve("data", "rooms.db");

  // Ensure parent directory exists (unless :memory:)
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      code TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  const stmtGet = db.prepare("SELECT data FROM rooms WHERE code = ?");
  const stmtHas = db.prepare("SELECT 1 FROM rooms WHERE code = ?");
  const stmtSet = db.prepare(
    "INSERT INTO rooms (code, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at"
  );
  const stmtDelete = db.prepare("DELETE FROM rooms WHERE code = ?");
  const stmtAll = db.prepare("SELECT code, data FROM rooms");
  const stmtCount = db.prepare("SELECT COUNT(*) AS cnt FROM rooms");
  const stmtPruneStale = db.prepare("DELETE FROM rooms WHERE updated_at < ?");

  return {
    hasRoom(code) {
      return stmtHas.get(code) !== undefined;
    },

    getRoom(code) {
      const row = stmtGet.get(code);
      if (!row) return null;
      return JSON.parse(row.data);
    },

    setRoom(code, room) {
      stmtSet.run(code, JSON.stringify(room), Date.now());
    },

    deleteRoom(code) {
      stmtDelete.run(code);
    },

    entries() {
      const rows = stmtAll.all();
      return rows.map((row) => [row.code, JSON.parse(row.data)])[Symbol.iterator]();
    },

    size() {
      return stmtCount.get().cnt;
    },

    /** Remove rooms older than cutoffMs milliseconds. */
    pruneStale(cutoffMs) {
      const threshold = Date.now() - cutoffMs;
      return stmtPruneStale.run(threshold).changes;
    },

    /** Close the database connection. */
    close() {
      db.close();
    }
  };
}
