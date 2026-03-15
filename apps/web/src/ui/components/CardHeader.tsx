import type { PropsWithChildren, HTMLAttributes } from "react";

export interface CardHeaderProps extends PropsWithChildren, HTMLAttributes<HTMLDivElement> {
  className?: string;
  ariaHidden?: boolean;
}

export function CardHeader({ className = "", ariaHidden = true, children, ...rest }: CardHeaderProps) {
  return (
    <div className={className} aria-hidden={ariaHidden} {...rest}>
      {children}
    </div>
  );
}
