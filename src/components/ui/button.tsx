import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// The app's buttons: three types (primary, secondary, text) in two sizes
// (default: 48pt, 12px corners, for forms and main actions; sm: 32pt pill,
// for Follow and inline actions), plus destructive. Hand-styled buttons
// use buttonVariants() so every button shares one look.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold ring-offset-background transition-[transform,opacity,background-color,color] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground active:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground active:bg-destructive/90",
        outline: "border border-border bg-transparent text-foreground active:bg-secondary",
        secondary: "bg-secondary text-secondary-foreground active:bg-secondary/80",
        ghost: "bg-transparent text-primary active:opacity-70",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 rounded-lg px-5 text-base",
        sm: "h-8 rounded-full px-4 text-sm",
        lg: "h-12 rounded-lg px-6 text-base",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
