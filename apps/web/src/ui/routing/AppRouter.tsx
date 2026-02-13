import { createContext, useContext, useEffect, type PropsWithChildren } from "react";
import type { RouteState } from "../../types";
import { useHashRouting } from "../hooks/useHashRouting";

interface AppRouterContextValue {
  route: RouteState;
  goTo: (screen: RouteState["screen"], options?: { replace?: boolean }) => void;
}

const AppRouterContext = createContext<AppRouterContextValue | null>(null);

export function AppRouter({ children }: PropsWithChildren) {
  const { route, goTo } = useHashRouting();

  useEffect(() => {
    document.body.dataset.routeScreen = route.screen;
  }, [route.screen]);

  return (
    <AppRouterContext.Provider value={{ route, goTo }}>
      {children}
    </AppRouterContext.Provider>
  );
}

export function useAppRouter() {
  const value = useContext(AppRouterContext);
  if (!value) {
    throw new Error("useAppRouter must be used within AppRouter");
  }
  return value;
}
