import type { ReactNode } from "react";
import { AlertCircle, CheckCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type BannerVariant = "success" | "warning" | "error" | "info";

const VARIANT_CLASSES: Record<BannerVariant, string> = {
  success: "bg-green-50 border-green-200 text-green-800",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
  error: "bg-red-50 border-red-200 text-red-800",
  info: "bg-blue-50 border-blue-200 text-blue-800",
};

const VARIANT_ICONS: Record<BannerVariant, typeof CheckCircle> = {
  success: CheckCircle,
  warning: AlertCircle,
  error: AlertCircle,
  info: Info,
};

interface InlineBannerProps {
  variant: BannerVariant;
  children: ReactNode;
  /** Right-aligned slot — e.g. a "View portfolio →" button or dismiss "✕". */
  action?: ReactNode;
  className?: string;
}

/**
 * Status banner (success/warning/error/info) — one styling source for the
 * inline banners that used to be hand-rolled per page (session ended,
 * hardware check passed, reconnecting, load failures, ...).
 */
export default function InlineBanner({ variant, children, action, className }: InlineBannerProps) {
  const Icon = VARIANT_ICONS[variant];
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <div className="flex-1">{children}</div>
      {action}
    </div>
  );
}
