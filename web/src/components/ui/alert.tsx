import * as React from "react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm animate-in fade-in duration-200",
  {
    variants: {
      variant: {
        destructive: "border-destructive/40 bg-destructive/10 text-destructive",
        warning: "border-amber-400/50 bg-amber-50 text-amber-800",
        info: "border-blue-200 bg-blue-50 text-blue-800",
      },
    },
    defaultVariants: {
      variant: "destructive",
    },
  }
);

const ALERT_ICONS = {
  destructive: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

/**
 * Inline contextual alert (F-26) — lightweight error/warning/info banner for
 * page-level and form-level feedback. Destructive variant with icon by default.
 */
const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "destructive", children, ...props }, ref) => {
    const Icon = ALERT_ICONS[variant ?? "destructive"];
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="grow min-w-0">{children}</div>
      </div>
    );
  }
);
Alert.displayName = "Alert";

export { Alert, alertVariants };