export function indexToCoord(index, size) {
  if (!Number.isInteger(index) || index < 0) return null;
  return {
    row: Math.floor(index / size),
    col: index % size
  };
}

export function coordToIndex(row, col, size) {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
  if (!isInBounds(row, col, size)) return null;
  return row * size + col;
}

export function isInBounds(row, col, size) {
  return row >= 0 && row < size && col >= 0 && col < size;
}

export function getShipCells(startIndex, orientation, length, size) {
  const start = indexToCoord(startIndex, size);
  if (!start) return { error: "Invalid start index.", cells: [] };
  if (orientation !== "h" && orientation !== "v") {
    return { error: "Invalid orientation.", cells: [] };
  }
  if (!Number.isInteger(length) || length < 1) {
    return { error: "Invalid ship length.", cells: [] };
  }

  const cells = [];
  for (let offset = 0; offset < length; offset += 1) {
    const row = orientation === "v" ? start.row + offset : start.row;
    const col = orientation === "h" ? start.col + offset : start.col;
    if (!isInBounds(row, col, size)) {
      return { error: "Ship goes out of bounds.", cells: [] };
    }
    const index = coordToIndex(row, col, size);
    if (index === null) {
      return { error: "Ship goes out of bounds.", cells: [] };
    }
    cells.push(index);
  }

  return { error: null, cells };
}

export function hasCellOverlap(cellsA, cellsB) {
  const setB = new Set(cellsB);
  return cellsA.some((cell) => setB.has(cell));
}

export function resolveShotResult(targetShips, shotIndex) {
  const isHit = targetShips.some((ship) => ship.cells.includes(shotIndex));
  return isHit ? "hit" : "miss";
}
