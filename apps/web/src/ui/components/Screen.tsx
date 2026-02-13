import type { PropsWithChildren } from "react";

export interface ScreenProps extends PropsWithChildren {
  id: string;
  active?: boolean;
  className?: string;
}

export function Screen({ id, active = false, className = "", children }: ScreenProps) {
  const classes = [`screen`, active ? "active" : "", className].filter(Boolean).join(" ");
  return (
    <section id={id} className={classes}>
      {children}
    </section>
  );
}
