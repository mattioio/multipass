import { useEffect, useMemo, useState } from "react";
import type { RouteState, ScreenKey } from "../../types";
import { parseScreenRoute } from "../../legacy/hashRoute.js";

const HASH_TO_SCREEN: Record<string, ScreenKey> = {
  "": "landing",
  "#local": "local",
  "#host": "host",
  "#join": "join",
  "#lobby": "lobby",
  "#pick": "pick",
  "#wait": "wait",
  "#game": "game",
  "#shuffle": "shuffle",
  "#winner": "winner",
  "#devkit": "devkit"
};

function parseRoute(hash: string): RouteState {
  const parsed = parseScreenRoute(hash, HASH_TO_SCREEN);
  const screen = (parsed.screen as ScreenKey | null) || "landing";

  return {
    hash,
    screen,
    join: {
      code: parsed.joinCode
    }
  };
}

export function useHashRouting() {
  const [hash, setHash] = useState(() => window.location.hash || "");

  useEffect(() => {
    const onHashChange = () => {
      setHash(window.location.hash || "");
    };

    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("popstate", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("popstate", onHashChange);
    };
  }, []);

  const route = useMemo(() => parseRoute(hash), [hash]);

  useEffect(() => {
    if (route.hash.toLowerCase() === "#landing") {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
      setHash("");
    }
  }, [route.hash]);

  const goTo = (screen: ScreenKey, { replace = false }: { replace?: boolean } = {}) => {
    const nextHash = screen === "landing" ? "" : `#${screen}`;
    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
    if (replace) {
      window.history.replaceState({ screen }, "", nextUrl);
      setHash(nextHash);
      return;
    }
    window.history.pushState({ screen }, "", nextUrl);
    setHash(nextHash);
  };

  return {
    route,
    goTo
  };
}
