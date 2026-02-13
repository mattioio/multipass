import type { HTMLAttributes, PropsWithChildren } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement>, PropsWithChildren {}

export function Card({ className = "", children, ...props }: CardProps) {
  return (
    <div {...props} className={`card ${className}`.trim()}>
      {children}
    </div>
  );
}
