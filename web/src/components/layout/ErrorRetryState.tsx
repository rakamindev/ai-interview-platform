import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface ErrorRetryStateProps {
  message: string;
  onRetry: () => void;
}

export default function ErrorRetryState({ message, onRetry }: ErrorRetryStateProps) {
  return (
    <div className="max-w-2xl mx-auto border border-destructive/40 rounded-lg p-6 text-center space-y-3">
      <p role="alert" className="text-sm text-destructive">
        {message}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
      </Button>
    </div>
  );
}
