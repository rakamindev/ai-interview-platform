import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown when a page's data failed to load. Without it the page rendered as empty
 * (or as an empty edit form that could be saved over the real record).
 */
export default function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" className="max-w-md mx-auto mt-16 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-3">
      <AlertTriangle className="h-7 w-7 text-destructive mx-auto" />
      <p className="text-sm font-medium">Couldn't load {what}</p>
      <p className="text-xs text-muted-foreground">Check your connection and try again. Nothing was changed.</p>
      <Button size="sm" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5 mr-1" />
        Try again
      </Button>
    </div>
  );
}
