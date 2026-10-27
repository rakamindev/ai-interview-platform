import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ErrorStateProps {
  /** What failed and what the user can do, e.g. "Could not load vacancies. Check your connection and try again." */
  message: ReactNode;
  /** Shows a retry button when given. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Extra actions next to the retry button, e.g. a link back. */
  children?: ReactNode;
}

/** A failed load or action. Announced to screen readers; keeps the rest of the page usable. */
export default function ErrorState({ message, onRetry, retryLabel = "Try again", children }: ErrorStateProps) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
      <div className="flex-1 space-y-2">
        <p className="text-sm">{message}</p>
        {(onRetry || children) && (
          <div className="flex flex-wrap gap-2">
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                {retryLabel}
              </Button>
            )}
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
