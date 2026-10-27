import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps content in a container that applies an entry fade-in animation on mount.
 * Use it around page components to animate content entry during route changes.
 */
export default function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <div className={cn("animate-in fade-in-50 duration-300 ease-out", className)}>
      {children}
    </div>
  );
}
