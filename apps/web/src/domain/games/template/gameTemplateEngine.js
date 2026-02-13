export function createGameTemplateEngine() {
  return {
    init(players) {
      return {
        playerOrder: players.map((player) => player.id),
        nextPlayerId: players[0]?.id ?? null,
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

      return {
        state: {
          ...state,
          history: [...state.history, { playerId, move }],
          nextPlayerId: state.playerOrder.find((id) => id !== playerId) ?? null
        }
      };
    }
  };
}
