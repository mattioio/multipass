import type { PropsWithChildren } from "react";
import { RuntimeProvider } from "../../app/runtime";

export interface AppProvidersProps extends PropsWithChildren {}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <RuntimeProvider>
      {children}
    </RuntimeProvider>
  );
}
