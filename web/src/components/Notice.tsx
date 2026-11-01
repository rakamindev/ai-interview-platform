import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type NoticeVariant = "error" | "warning" | "info" | "success";

const VARIANT_STYLES: Record<NoticeVariant, { box: string; icon: typeof Info }> = {
  error: { box: "border-destructive/30 bg-destructive/5 text-destructive", icon: AlertCircle },
  warning: {
    box: "border-rakamin-yellow/60 bg-rakamin-yellow/15 text-rakamin-charcoal",
    icon: AlertTriangle,
  },
  info: { box: "border-rakamin-teal/30 bg-rakamin-light-cyan text-rakamin-dark-teal", icon: Info },
  success: { box: "border-green-600/25 bg-green-50 text-green-800", icon: CheckCircle2 },
};

interface NoticeProps {
  variant: NoticeVariant;
  title?: string;
  children?: ReactNode;
  // Buttons or links shown at the end of the notice (e.g. Retry, Dismiss).
  action?: ReactNode;
  className?: string;
}

// Inline banner for page, form, and connection messages. Errors are announced immediately.
export default function Notice({ variant, title, children, action, className }: NoticeProps) {
  const { box, icon: Icon } = VARIANT_STYLES[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm sm:flex-row sm:items-center",
        box,
        className,
      )}
    >
      <div className="flex flex-1 items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-0.5">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className={cn(title && "opacity-90")}>{children}</div>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2 pl-6 sm:pl-0">{action}</div>}
    </div>
  );
}
