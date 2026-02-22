import { getShipCells, hasCellOverlap, resolveShotResult } from "../mechanics/grid.js";

const BOARD_SIZE = 6;
const SHIP_LENGTH = 2;
const SHIPS_PER_PLAYER = 2;

function getOtherPlayerId(state, playerId) {
  return state.playerOrder.find((id) => id !== playerId) || null;
}

function getPlayerShips(state, playerId) {
  return state.placements[playerId]?.ships || [];
}

function getAllShipCells(ships) {
  return ships.flatMap((ship) => ship.cells);
}

function countPlacedShips(state, playerId) {
  return getPlayerShips(state, playerId).length;
}

function allShipsPlaced(state) {
  return state.playerOrder.every((playerId) => countPlacedShips(state, playerId) >= state.shipsPerPlayer);
}

function ensureValidPlayer(state, playerId) {
  return state.playerOrder.includes(playerId);
}

function cloneShots(shotsByPlayer) {
  return Object.fromEntries(
    Object.entries(shotsByPlayer).map(([playerId, shots]) => [playerId, [...shots]])
  );
}

export function createBattleshipsEngine() {
  return {
    init(players) {
      const [p1, p2] = players;
      const playerOrder = [p1?.id, p2?.id].filter(Boolean);
      const placements = Object.fromEntries(
        playerOrder.map((playerId) => [playerId, { ships: [] }])
      );
      const shotsByPlayer = Object.fromEntries(
        playerOrder.map((playerId) => [playerId, []])
      );

      return {
        phase: "placement",
        boardSize: BOARD_SIZE,
        shipLength: SHIP_LENGTH,
        shipsPerPlayer: SHIPS_PER_PLAYER,
        playerOrder,
        nextPlayerId: playerOrder[0] || null,
        winnerId: null,
        draw: false,
        placements,
        shotsByPlayer,
        shotHistory: []
      };
    },

    applyMove(state, move, playerId) {
      if (state.winnerId || state.draw || state.phase === "finished") {
        return { error: "Game is already finished." };
      }
      if (!ensureValidPlayer(state, playerId)) {
        return { error: "Unknown player." };
      }
      if (playerId !== state.nextPlayerId) {
        return { error: "Not your turn." };
      }

      if (state.phase === "placement") {
        const start = Number(move?.index ?? move?.start);
        const orientation = String(move?.orientation || "h").toLowerCase();
        if (!Number.isInteger(start) || start < 0 || start >= state.boardSize * state.boardSize) {
          return { error: "Invalid placement cell." };
        }
        if (orientation !== "h" && orientation !== "v") {
          return { error: "Invalid ship orientation." };
        }

        const ships = getPlayerShips(state, playerId);
        if (ships.length >= state.shipsPerPlayer) {
          return { error: "All ships already placed." };
        }

        const shipCells = getShipCells(start, orientation, state.shipLength, state.boardSize);
        if (shipCells.error) {
          return { error: shipCells.error };
        }

        const occupiedCells = getAllShipCells(ships);
        if (hasCellOverlap(shipCells.cells, occupiedCells)) {
          return { error: "Ships cannot overlap." };
        }

        const updatedPlacements = {
          ...state.placements,
          [playerId]: {
            ships: [
              ...ships,
              {
                id: `ship_${playerId}_${ships.length + 1}`,
                orientation,
                cells: shipCells.cells
              }
            ]
          }
        };

        const nextPlayerId = getOtherPlayerId(state, playerId);
        const placedState = {
          ...state,
          placements: updatedPlacements,
          nextPlayerId
        };

        if (!allShipsPlaced(placedState)) {
          return { state: placedState };
        }

        return {
          state: {
            ...placedState,
            phase: "battle",
            nextPlayerId: state.playerOrder[0] || nextPlayerId
          }
        };
      }

      if (state.phase !== "battle") {
        return { error: "Invalid game phase." };
      }

      const shotIndex = Number(move?.index);
      if (!Number.isInteger(shotIndex) || shotIndex < 0 || shotIndex >= state.boardSize * state.boardSize) {
        return { error: "Invalid target cell." };
      }

      const defenderId = getOtherPlayerId(state, playerId);
      if (!defenderId) {
        return { error: "Missing opponent." };
      }

      const attackerShots = state.shotsByPlayer[playerId] || [];
      if (attackerShots.includes(shotIndex)) {
        return { error: "You already fired at that cell." };
      }

      const defenderShips = getPlayerShips(state, defenderId);
      const result = resolveShotResult(defenderShips, shotIndex);
      const nextShotsByPlayer = cloneShots(state.shotsByPlayer);
      nextShotsByPlayer[playerId] = [...attackerShots, shotIndex];

      const defenderShipCells = getAllShipCells(defenderShips);
      const isWinner = defenderShipCells.length > 0
        && defenderShipCells.every((cell) => nextShotsByPlayer[playerId].includes(cell));

      const nextState = {
        ...state,
        shotsByPlayer: nextShotsByPlayer,
        shotHistory: [
          ...state.shotHistory,
          {
            attackerId: playerId,
            defenderId,
            index: shotIndex,
            result
          }
        ]
      };

      if (isWinner) {
        return {
          state: {
            ...nextState,
            phase: "finished",
            winnerId: playerId,
            nextPlayerId: null
          }
        };
      }

      return {
        state: {
          ...nextState,
          nextPlayerId: defenderId
        }
      };
    },

    getVisibleState(state, viewerPlayerId) {
      if (!viewerPlayerId || !state.playerOrder.includes(viewerPlayerId)) {
        return {
          phase: state.phase,
          boardSize: state.boardSize,
          shipLength: state.shipLength,
          shipsPerPlayer: state.shipsPerPlayer,
          playerOrder: state.playerOrder,
          nextPlayerId: state.nextPlayerId,
          winnerId: state.winnerId,
          draw: state.draw,
          ownBoard: { ships: [], hitsReceived: [], missesReceived: [] },
          targetBoard: { hits: [], misses: [] }
        };
      }

      const opponentId = getOtherPlayerId(state, viewerPlayerId);
      const viewerShips = getPlayerShips(state, viewerPlayerId);
      const opponentShots = state.shotsByPlayer[opponentId] || [];
      const viewerShipCells = getAllShipCells(viewerShips);
      const hitsReceived = opponentShots.filter((index) => viewerShipCells.includes(index));
      const missesReceived = opponentShots.filter((index) => !viewerShipCells.includes(index));

      const viewerShots = state.shotsByPlayer[viewerPlayerId] || [];
      const opponentShips = getPlayerShips(state, opponentId);
      const opponentShipCells = getAllShipCells(opponentShips);
      const targetHits = viewerShots.filter((index) => opponentShipCells.includes(index));
      const targetMisses = viewerShots.filter((index) => !opponentShipCells.includes(index));

      return {
        phase: state.phase,
        boardSize: state.boardSize,
        shipLength: state.shipLength,
        shipsPerPlayer: state.shipsPerPlayer,
        playerOrder: state.playerOrder,
        nextPlayerId: state.nextPlayerId,
        winnerId: state.winnerId,
        draw: state.draw,
        ownBoard: {
          ships: viewerShips.map((ship) => ({ id: ship.id, cells: [...ship.cells] })),
          hitsReceived,
          missesReceived
        },
        targetBoard: {
          hits: targetHits,
          misses: targetMisses
        }
      };
    }
  };
}
