import { Plus } from "lucide-react";
import { Button } from "@/shared/ui/button";

interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** "Nothing here yet" block for list pages — was duplicated per entity. */
export default function EmptyState({ message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="rounded-lg border p-12 text-center text-sm text-muted-foreground">
      <p className="mb-3">{message}</p>
      {actionLabel && onAction && (
        <Button variant="outline" onClick={onAction}>
          <Plus className="mr-1.5 h-4 w-4" /> {actionLabel}
        </Button>
      )}
    </div>
  );
}
