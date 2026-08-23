import React from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: LucideIcon;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon: ActionIcon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-slate-50/50">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-4">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 mb-6 max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="default">
          {ActionIcon && <ActionIcon className="w-4 h-4 mr-2" />}
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
