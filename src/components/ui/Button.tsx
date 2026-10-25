import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "border border-control bg-surface text-ink hover:bg-sunken",
  ghost: "text-primary hover:bg-primary-tint",
  danger: "bg-danger text-white hover:brightness-90",
};

// min-h-11 = 44px touch target.
export const buttonClass = (variant: Variant = "primary", extra = "") =>
  `inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${extra}`;

export function Button({ variant, className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({ variant, className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
