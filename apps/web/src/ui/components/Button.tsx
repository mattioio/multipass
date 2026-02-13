import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

export type ButtonVariant = "primary" | "ghost" | "small" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, PropsWithChildren {
  variant?: ButtonVariant;
}

const variantClassMap: Record<ButtonVariant, string> = {
  primary: "glow-button",
  ghost: "ghost",
  small: "glow-button small",
  danger: "ghost end-game"
};

export function Button({ variant = "primary", className = "", children, ...props }: ButtonProps) {
  const baseClassName = variantClassMap[variant];
  const merged = `${baseClassName} ${className}`.trim();
  return (
    <button {...props} className={merged}>
      {children}
    </button>
  );
}
