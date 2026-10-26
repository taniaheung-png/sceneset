import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

// Observed in the reference: navy primary with a soft shadow, paper secondary with a hairline, tinted danger, 8 px radius.
const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary shadow-[0_4px_9px_rgb(23_53_83/0.14)] hover:-translate-y-px hover:bg-primary-hover",
  secondary: "border border-control bg-surface text-navy hover:border-ink-2 hover:bg-paper",
  ghost: "text-primary hover:bg-primary-tint",
  danger: "border border-danger bg-danger-tint text-danger hover:bg-coral-soft",
};

// min-h-11 = 44px touch target (the reference's 38px is below the accessibility floor this product commits to).
export const buttonClass = (variant: Variant = "primary", extra = "") =>
  `inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition duration-150 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${extra}`;

export function Button({ variant, className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({ variant, className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
