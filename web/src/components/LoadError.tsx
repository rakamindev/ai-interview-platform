import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import Notice from "@/components/Notice";

interface LoadErrorProps {
  message: string;
  onRetry?: () => void;
}

export default function LoadError({ message, onRetry }: LoadErrorProps) {
  return (
    <Notice
      variant="error"
      action={
        onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw /> Retry
          </Button>
        )
      }
    >
      {message}
    </Notice>
  );
}
