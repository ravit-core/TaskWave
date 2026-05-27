import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * TaskWave Button — reference component for the Graphite & Coral system.
 *
 * Variants in order of weight:
 *   primary  — graphite fill, cream text. The default CTA.
 *   accent   — coral fill, ink text. Use sparingly (1–2 per screen).
 *   secondary — soft surface, ink text, hairline border. Tertiary CTAs.
 *   outline  — transparent, ink border. Quiet actions.
 *   ghost    — transparent, ink-soft text. In-row affordances.
 *   link     — coral underline. Inline navigation.
 *   danger   — deep coral-red. Destructive (rare — voice handles delete).
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-medium select-none",
    "focus-visible:outline-none",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:translate-y-[1px]",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: [
          "bg-ink text-on-ink rounded-lg shadow-sm",
          "hover:bg-ink/92 hover:shadow-md",
          "active:shadow-xs",
        ].join(" "),
        accent: [
          "bg-accent text-ink rounded-lg shadow-sm",
          "hover:bg-accent-deep hover:text-on-ink hover:shadow-md",
        ].join(" "),
        secondary: [
          "bg-surface-soft text-ink border border-line rounded-lg",
          "hover:bg-surface-sunk hover:border-line-strong",
        ].join(" "),
        outline: [
          "bg-transparent text-ink border border-line-strong rounded-lg",
          "hover:bg-surface-soft",
        ].join(" "),
        ghost: [
          "bg-transparent text-ink-soft rounded-lg",
          "hover:bg-surface-soft hover:text-ink",
        ].join(" "),
        link: [
          "bg-transparent text-accent-deep p-0 h-auto",
          "underline underline-offset-4 decoration-accent/40",
          "hover:decoration-accent-deep",
        ].join(" "),
        danger: [
          "bg-danger text-on-ink rounded-lg shadow-sm",
          "hover:opacity-92 hover:shadow-md",
        ].join(" "),
      },
      size: {
        sm: "h-9 px-3.5 text-xs",
        default: "h-10 px-5 text-sm",
        lg: "h-12 px-7 text-base",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8 text-xs",
        "icon-lg": "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
