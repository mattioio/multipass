import type { PropsWithChildren } from "react";

export interface CardHeaderProps extends PropsWithChildren {
  className?: string;
  ariaHidden?: boolean;
}

export function CardHeader({ className = "", ariaHidden = true, children }: CardHeaderProps) {
  return (
    <div className={className} aria-hidden={ariaHidden}>
      {children}
    </div>
  );
}
