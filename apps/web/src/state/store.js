export function createStore(initialState, reducer) {
  const state = initialState;
  const listeners = new Set();

  function getState() {
    return state;
  }

  function dispatch(action) {
    reducer(state, action);
    listeners.forEach((listener) => listener(state, action));
    return action;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    getState,
    dispatch,
    subscribe
  };
}
