import * as React from "react";
import { cva } from "class-variance-authority";
import { AlertTriangle, Info, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type CalloutVariant = "info" | "warning" | "error";

const calloutVariants = cva("flex gap-3 rounded-lg border p-4 text-sm", {
  variants: {
    variant: {
      info: "border-sky-200 bg-sky-50 text-sky-950",
      warning: "border-amber-200 bg-amber-50 text-amber-950",
      error: "border-red-200 bg-red-50 text-red-950",
    },
  },
  defaultVariants: { variant: "info" },
});

const ICONS: Record<CalloutVariant, LucideIcon> = { info: Info, warning: AlertTriangle, error: XCircle };

export interface CalloutProps {
  variant?: CalloutVariant;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  role?: "note" | "alert" | "status";
  className?: string;
}

// A banner with an icon, a title (its accessible name), a body and an action.
export function Callout({ variant = "info", title, children, action, role = "note", className }: CalloutProps) {
  const titleId = React.useId();
  const Icon = ICONS[variant];

  return (
    <div role={role} aria-labelledby={titleId} data-variant={variant} className={cn(calloutVariants({ variant }), className)}>
      <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        <p id={titleId} className="font-semibold">{title}</p>
        {children && <div className="[overflow-wrap:anywhere]">{children}</div>}
        {action && <div className="flex flex-wrap gap-2 pt-2">{action}</div>}
      </div>
    </div>
  );
}
