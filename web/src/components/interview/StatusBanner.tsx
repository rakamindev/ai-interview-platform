import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type BannerTone = "info" | "warning" | "danger" | "success";

interface StatusBannerProps {
  tone: BannerTone;
  icon?: ReactNode;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

/**
 * One banner, four tones.
 *
 * The interview screen had three near-identical banner blocks with slightly
 * different padding, alignment and hardcoded colours (yellow-50, red-50,
 * blue-50) — none of which had a dark-mode definition. This uses the semantic
 * status tokens instead, so "warning" looks the same everywhere and follows the
 * theme.
 */
const TONE_CLASSES: Record<BannerTone, string> = {
  info: "bg-info-subtle border-info-border text-foreground",
  warning: "bg-warning-subtle border-warning-border text-foreground",
  danger: "bg-danger-subtle border-danger-border text-foreground",
  success: "bg-success-subtle border-success-border text-foreground",
};

const DOT_CLASSES: Record<BannerTone, string> = {
  info: "bg-info",
  warning: "bg-warning",
  danger: "bg-destructive",
  success: "bg-success",
};

export default function StatusBanner({ tone, icon, children, onDismiss, className }: StatusBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-tone={tone}
      className={cn(
        "mt-2 flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm leading-relaxed",
        TONE_CLASSES[tone],
        className
      )}
    >
      <span className="mt-[0.3rem] shrink-0" aria-hidden="true">
        {icon ?? <span className={cn("block h-2 w-2 rounded-full motion-safe-only animate-pulse", DOT_CLASSES[tone])} />}
      </span>

      <div className="min-w-0 flex-1 break-words">{children}</div>

      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="-mr-1 shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
