import { ActionTypes } from "./actions.js";

/**
 * Mutable reducer for incremental migration.
 * It mutates state in place and returns the same reference,
 * so legacy call sites holding `state` continue to work.
 */
export function reducer(state, action) {
  if (!action || typeof action.type !== "string") return state;

  switch (action.type) {
    case ActionTypes.WS_SET: {
      state.ws = action.payload.ws;
      return state;
    }
    case ActionTypes.CLIENT_ID_SET: {
      state.clientId = action.payload.clientId;
      return state;
    }
    case ActionTypes.WS_ROOM_STATE_RECEIVED: {
      state.room = action.payload.room;
      state.you = action.payload.you;
      return state;
    }
    case ActionTypes.MODE_SET: {
      state.mode = action.payload.mode;
      return state;
    }
    case ActionTypes.SCREEN_CHANGED: {
      state.activeScreen = action.payload.screen;
      return state;
    }
    case ActionTypes.LOCAL_STEP_SET: {
      state.localStep = action.payload.step;
      return state;
    }
    case ActionTypes.LOCAL_AVATAR_SET: {
      const { slot, avatarId } = action.payload;
      state.localAvatars[slot] = avatarId;
      return state;
    }
    case ActionTypes.LOCAL_WHEEL_RESET: {
      state.localSpinInProgress = false;
      state.localHasSpun = false;
      state.localWheel = { angle: 0, targetAngle: 0, winnerId: null, segmentCount: 6 };
      return state;
    }
    case ActionTypes.LOCAL_SPIN_STATE_SET: {
      state.localSpinInProgress = Boolean(action.payload.inProgress);
      return state;
    }
    case ActionTypes.LOCAL_HAS_SPUN_SET: {
      state.localHasSpun = Boolean(action.payload.hasSpun);
      return state;
    }
    case ActionTypes.LAST_ROOM_CODE_SET: {
      state.lastRoomCode = action.payload.code || null;
      return state;
    }
    case ActionTypes.AUTO_JOIN_CODE_SET: {
      state.autoJoinCode = action.payload.code || null;
      return state;
    }
    default:
      return state;
  }
}
