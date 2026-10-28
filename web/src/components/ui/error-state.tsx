import * as React from "react";
import { AlertCircle, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  title: string;
  description?: React.ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  retryLabel?: string;
  action?: React.ReactNode;
  className?: string;
}

// An error announced to screen readers, with a retry that cannot be double clicked.
export function ErrorState({ title, description, onRetry, retrying = false, retryLabel = "Try again", action, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-8 text-center text-red-950", className)}
    >
      <AlertCircle aria-hidden="true" className="h-8 w-8 text-red-700" />
      <p className="text-base font-semibold">{title}</p>
      {description && <p className="max-w-md text-sm">{description}</p>}
      {(onRetry || action) && (
        <div className="flex flex-wrap justify-center gap-2">
          {onRetry && (
            <Button type="button" variant="outline" onClick={onRetry} disabled={retrying}>
              {retrying ? <Loader2 aria-hidden="true" className="animate-spin" /> : <RotateCw aria-hidden="true" />}
              {retrying ? "Trying again" : retryLabel}
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  );
}
