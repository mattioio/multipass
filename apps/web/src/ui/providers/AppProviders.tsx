import type { PropsWithChildren } from "react";

export interface AppProvidersProps extends PropsWithChildren {}

export function AppProviders({ children }: AppProvidersProps) {
  return <>{children}</>;
}
