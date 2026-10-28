import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

export function LoadingSpinner({ size = "md", className, ...props }: LoadingSpinnerProps) {
  return (
    <Loader2
      className={cn("animate-spin text-primary", sizeClasses[size], className)}
      {...props}
    />
  );
}

export function LoadingBar({ className }: { className?: string }) {
  return (
    <div className={cn("relative w-full h-1 bg-primary/10 overflow-hidden", className)}>
      <div className="absolute inset-y-0 w-1/2 bg-primary animate-indeterminate rounded-full" />
    </div>
  );
}

export function LoadingOverlay({
  message = "Loading...",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/60 backdrop-blur-xs rounded-xl transition-all duration-300",
        className
      )}
    >
      <div className="flex flex-col items-center gap-2 p-4 bg-card/90 border shadow-md rounded-xl">
        <LoadingSpinner size="lg" />
        <p className="text-xs font-medium text-muted-foreground animate-pulse">{message}</p>
      </div>
    </div>
  );
}

export function PageLoading({
  message = "Loading dashboard...",
  subtext = "Fetching real-time interviews and session data",
}: {
  message?: string;
  subtext?: string;
}) {
  return (
    <div className="py-24 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-300">
      <div className="relative flex items-center justify-center">
        <div className="absolute h-16 w-16 rounded-full bg-primary/10 animate-ping" />
        <div className="relative h-12 w-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold tracking-tight text-foreground">{message}</p>
        {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
      </div>
    </div>
  );
}

