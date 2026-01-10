import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary-500 text-white hover:bg-primary-600 shadow-sm hover:shadow-md",
        destructive:
          "bg-red-500 text-white hover:bg-red-600",
        outline:
          "border-2 border-input bg-background hover:bg-accent/10 hover:border-accent",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent/10 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        sage: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-sage hover:shadow-md hover:-translate-y-0.5 border-2 border-accent/50",
        "sage-outline": "border-2 border-accent text-foreground hover:bg-accent/10",
        glass: "bg-white/60 backdrop-blur-xl border-2 border-white/70 text-foreground hover:bg-white/80 shadow-glass",
        hero: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-sage hover:shadow-md hover:-translate-y-1 px-8 py-6 text-base border-2 border-accent/50",
        "hero-outline": "border-2 border-accent/50 text-foreground hover:bg-accent/10 hover:border-accent px-8 py-6 text-base backdrop-blur-sm",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 rounded-lg px-4",
        lg: "h-12 rounded-xl px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
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
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

