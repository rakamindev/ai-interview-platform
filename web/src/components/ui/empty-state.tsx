import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: LucideIcon;
  children?: ReactNode;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon: ActionIcon,
  children,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center border rounded-lg px-6 py-14 text-center">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="outline" className="mt-4" onClick={onAction}>
          {ActionIcon && <ActionIcon className="h-4 w-4 mr-1.5" />}
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  );
}