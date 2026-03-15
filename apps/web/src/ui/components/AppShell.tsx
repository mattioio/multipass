import type { PropsWithChildren, ReactNode } from "react";

export interface AppShellProps extends PropsWithChildren {
  /** Declarative nav element rendered above main content */
  nav?: ReactNode;
}

export function AppShell({ children, nav }: AppShellProps) {
  const isDevBuild = import.meta.env.DEV;

  return (
    <div id="app">
      {isDevBuild ? <div id="dev-build-tag">dev build</div> : null}
      {nav}
      <main>{children}</main>
    </div>
  );
}
