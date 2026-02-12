export const ActionTypes = {
  WS_SET: "WS_SET",
  CLIENT_ID_SET: "CLIENT_ID_SET",
  WS_ROOM_STATE_RECEIVED: "WS_ROOM_STATE_RECEIVED",
  MODE_SET: "MODE_SET",
  SCREEN_CHANGED: "SCREEN_CHANGED",
  LOCAL_STEP_SET: "LOCAL_STEP_SET",
  LOCAL_FRUIT_SET: "LOCAL_FRUIT_SET",
  LOCAL_WHEEL_RESET: "LOCAL_WHEEL_RESET",
  LOCAL_SPIN_STATE_SET: "LOCAL_SPIN_STATE_SET",
  LOCAL_HAS_SPUN_SET: "LOCAL_HAS_SPUN_SET",
  LAST_ROOM_CODE_SET: "LAST_ROOM_CODE_SET",
  AUTO_JOIN_CODE_SET: "AUTO_JOIN_CODE_SET"
};

export const actions = {
  wsSet(ws) {
    return { type: ActionTypes.WS_SET, payload: { ws } };
  },
  clientIdSet(clientId) {
    return { type: ActionTypes.CLIENT_ID_SET, payload: { clientId } };
  },
  wsRoomStateReceived(room, you) {
    return { type: ActionTypes.WS_ROOM_STATE_RECEIVED, payload: { room, you } };
  },
  modeSet(mode) {
    return { type: ActionTypes.MODE_SET, payload: { mode } };
  },
  screenChanged(screen) {
    return { type: ActionTypes.SCREEN_CHANGED, payload: { screen } };
  },
  localStepSet(step) {
    return { type: ActionTypes.LOCAL_STEP_SET, payload: { step } };
  },
  localFruitSet(slot, fruitId) {
    return { type: ActionTypes.LOCAL_FRUIT_SET, payload: { slot, fruitId } };
  },
  localWheelReset() {
    return { type: ActionTypes.LOCAL_WHEEL_RESET };
  },
  localSpinStateSet(inProgress) {
    return { type: ActionTypes.LOCAL_SPIN_STATE_SET, payload: { inProgress } };
  },
  localHasSpunSet(hasSpun) {
    return { type: ActionTypes.LOCAL_HAS_SPUN_SET, payload: { hasSpun } };
  },
  lastRoomCodeSet(code) {
    return { type: ActionTypes.LAST_ROOM_CODE_SET, payload: { code } };
  },
  autoJoinCodeSet(code) {
    return { type: ActionTypes.AUTO_JOIN_CODE_SET, payload: { code } };
  }
};
