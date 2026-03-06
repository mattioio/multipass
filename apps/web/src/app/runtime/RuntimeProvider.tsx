import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef
} from "react";
import type { RuntimeState } from "../../types";
import { runtimeActions } from "./actions";
import { resolveRuntimeMode } from "./mode";
import { persistLastRoom } from "./persistence";
import { runtimeReducer } from "./reducer";
import { createInitialRuntimeState } from "./state";
import { createRuntimeWsSession, type RuntimeWsSession } from "./wsSession";

export interface RuntimeContextValue {
  state: RuntimeState;
  connect: () => void;
  disconnect: () => void;
  setMode: (mode: RuntimeState["mode"]) => void;
  setSettingsOpen: (open: boolean) => void;
  setJoinCode: (code: string) => void;
  setLastRoom: (code: string | null, startedAt: number | null) => void;
  validateRoom: (code: string) => void;
  createRoom: (avatar: string, honorific?: "mr" | "mrs" | null) => void;
  joinRoom: (code: string, avatar?: string | null, honorific?: "mr" | "mrs" | null) => void;
  send: (payload: unknown) => boolean;
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

export function RuntimeProvider({ children }: PropsWithChildren) {
  const runtimeMode = resolveRuntimeMode();
  const isTestMode = import.meta.env.MODE === "test";
  const [state, dispatch] = useReducer(runtimeReducer, runtimeMode, createInitialRuntimeState);
  const stateRef = useRef(state);
  const sessionRef = useRef<RuntimeWsSession | null>(null);
  const pendingValidateCodeRef = useRef<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (runtimeMode !== "react" || isTestMode) return;
    const session = createRuntimeWsSession({
      dispatch,
      getState: () => stateRef.current,
      log: (message, details) => {
        if (!import.meta.env.DEV) return;
        if (details === undefined) {
          console.info(`[runtime] ${message}`);
          return;
        }
        console.info(`[runtime] ${message}`, details);
      }
    });
    sessionRef.current = session;
    session.connect();
    if (pendingValidateCodeRef.current) {
      session.validateRoom(pendingValidateCodeRef.current);
      pendingValidateCodeRef.current = null;
    }
    return () => {
      session.disconnect();
      sessionRef.current = null;
    };
  }, [isTestMode, runtimeMode]);

  const value = useMemo<RuntimeContextValue>(() => {
    return {
      state,
      connect: () => sessionRef.current?.connect(),
      disconnect: () => sessionRef.current?.disconnect(),
      setMode: (mode) => dispatch(runtimeActions.modeSet(mode)),
      setSettingsOpen: (open) => dispatch(runtimeActions.settingsOpenSet(open)),
      setJoinCode: (code) => dispatch(runtimeActions.joinCodeSet(code)),
      setLastRoom: (code, startedAt) => {
        dispatch(runtimeActions.lastRoomSet(code, startedAt));
        persistLastRoom({ code, startedAt });
      },
      validateRoom: (code) => {
        const session = sessionRef.current;
        if (session) {
          session.validateRoom(code);
          return;
        }
        pendingValidateCodeRef.current = code;
        dispatch(runtimeActions.joinValidating());
      },
      createRoom: (avatar, honorific = "mr") => sessionRef.current?.createRoom(avatar, honorific),
      joinRoom: (code, avatar = null, honorific = "mr") => sessionRef.current?.joinRoom(code, avatar, honorific),
      send: (payload) => sessionRef.current?.send(payload) ?? false
    };
  }, [state]);

  return (
    <RuntimeContext.Provider value={value}>
      {children}
    </RuntimeContext.Provider>
  );
}

export function useRuntime() {
  const value = useContext(RuntimeContext);
  if (!value) {
    throw new Error("useRuntime must be used within RuntimeProvider");
  }
  return value;
}
