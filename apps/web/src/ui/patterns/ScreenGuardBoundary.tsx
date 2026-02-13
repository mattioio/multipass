import type { PropsWithChildren, ReactNode } from "react";

export interface ScreenGuardBoundaryProps extends PropsWithChildren {
  canRender: boolean;
  fallback?: ReactNode;
}

export function ScreenGuardBoundary({ canRender, fallback = null, children }: ScreenGuardBoundaryProps) {
  if (!canRender) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
