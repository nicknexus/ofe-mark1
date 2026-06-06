import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
 "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
 {
 variants: {
 variant: {
 // --- App (private SaaS tier) variants ---
 default:
 "bg-primary-500 text-white hover:bg-primary-600 shadow-lg shadow-primary-500/25",
 evidence:
 "bg-evidence-500 text-white hover:bg-evidence-600 shadow-lg shadow-evidence-500/25",
 destructive:
 "bg-red-500 text-white hover:bg-red-600 shadow-sm",
 outline:
 "border border-gray-200 bg-white text-secondary-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm",
 secondary:
 "bg-white hover:bg-gray-50 hover:border-gray-300 text-secondary-700 border border-gray-200 shadow-sm",
 ghost: "text-secondary-600 hover:bg-gray-100 hover:text-secondary-900",
 link: "text-primary-700 underline-offset-4 hover:underline",
 // --- Landing / marketing variants (do not use in the app tier) ---
 sage: "rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 shadow-sage hover:shadow-md hover:-translate-y-0.5 border-2 border-accent/50",
 "sage-outline": "rounded-xl border-2 border-accent text-foreground hover:bg-accent/10",
 glass: "rounded-xl bg-white/60 backdrop-blur-xl border-2 border-white/70 text-foreground hover:bg-white/80 shadow-glass",
 hero: "rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 shadow-sage hover:shadow-md hover:-translate-y-1 px-8 py-6 text-base border-2 border-accent/50",
 "hero-outline": "rounded-xl border-2 border-accent/50 text-foreground hover:bg-accent/10 hover:border-accent px-8 py-6 text-base backdrop-blur-sm",
 },
 size: {
 default: "h-10 px-4 py-2",
 sm: "h-8 px-3 text-[13px]",
 lg: "h-11 px-5 text-base",
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
