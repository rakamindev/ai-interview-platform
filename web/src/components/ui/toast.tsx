import { useAtom } from "jotai";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toastsAtom, dismissToast, type ToastItem, type ToastKind } from "@/stores/toastStore";

const ICONS: Record<ToastKind, typeof AlertCircle> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};

const ICON_STYLES: Record<ToastKind, string> = {
  error: "bg-red-50 text-red-600",
  warning: "bg-amber-50 text-amber-600",
  info: "bg-blue-50 text-blue-600",
  success: "bg-green-50 text-green-600",
};

function ToastCard({ item }: { item: ToastItem }) {
  const Icon = ICONS[item.kind];
  return (
    <div
      key={item.id}
      role={item.kind === "error" ? "alert" : "status"}
      className="flex items-start gap-3 rounded-lg border bg-white p-3.5 shadow-lg animate-in slide-in-from-top-2 fade-in duration-200"
    >
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", ICON_STYLES[item.kind])}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{item.title}</p>
        {item.message && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.message}</p>
        )}
        {item.onRetry && (
          <button
            type="button"
            onClick={item.onRetry}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Retry
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismissToast(item.id)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded p-0.5 text-muted-foreground opacity-60 transition-opacity hover:opacity-100"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Global toast viewport. Mount once at the app root — toasts are pushed via
 * the `toast` helper in stores/toastStore from anywhere (components, hooks,
 * the axios interceptor).
 */
export function ToastViewport() {
  const [toasts] = useAtom(toastsAtom);
  return (
    <div className="fixed right-4 top-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  );
}