import type { LucideIcon } from "lucide-react";
import { Inbox, Plus } from "lucide-react";
import { Button } from "@/shared/ui/button";

interface EmptyStateProps {
  icon?: LucideIcon;
  message: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon: Icon = Inbox,
  message,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed p-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-4 text-sm font-medium">{message}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="outline" onClick={onAction} className="mt-4">
          <Plus className="mr-1.5 h-4 w-4" /> {actionLabel}
        </Button>
      )}
    </div>
  );
}
