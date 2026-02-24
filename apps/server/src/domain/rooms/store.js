export function createRoomStore() {
  const rooms = new Map();

  return {
    hasRoom(code) {
      return rooms.has(code);
    },
    getRoom(code) {
      return rooms.get(code) || null;
    },
    setRoom(code, room) {
      rooms.set(code, room);
    },
    deleteRoom(code) {
      rooms.delete(code);
    },
    entries() {
      return rooms.entries();
    },
    size() {
      return rooms.size;
    }
  };
}
