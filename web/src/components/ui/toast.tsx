import React, { useEffect } from "react";
import { atom, useAtom } from "jotai";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastItem {
  id: string;
  title?: string;
  description: string;
  variant?: "default" | "success" | "destructive" | "warning" | "info";
  duration?: number;
}

export const toastsAtom = atom<ToastItem[]>([]);

let toastCount = 0;

export function addToast(item: Omit<ToastItem, "id">) {
  const id = `toast-${Date.now()}-${++toastCount}`;
  const duration = item.duration ?? 4000;
  
  // Update atom via direct store or listeners if outside react
  if (typeof window !== "undefined") {
    const event = new CustomEvent("app:add-toast", {
      detail: { ...item, id, duration },
    });
    window.dispatchEvent(event);
  }
  return id;
}

export const toast = {
  success: (description: string, title?: string) =>
    addToast({ description, title, variant: "success" }),
  error: (description: string, title?: string) =>
    addToast({ description, title, variant: "destructive" }),
  warning: (description: string, title?: string) =>
    addToast({ description, title, variant: "warning" }),
  info: (description: string, title?: string) =>
    addToast({ description, title, variant: "info" }),
  default: (description: string, title?: string) =>
    addToast({ description, title, variant: "default" }),
};

export function Toaster() {
  const [toasts, setToasts] = useAtom(toastsAtom);

  useEffect(() => {
    const handleAdd = (e: Event) => {
      const customEvent = e as CustomEvent<ToastItem>;
      const newToast = customEvent.detail;
      setToasts((prev) => [...prev, newToast]);

      if (newToast.duration && newToast.duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
        }, newToast.duration);
      }
    };

    window.addEventListener("app:add-toast", handleAdd);
    return () => window.removeEventListener("app:add-toast", handleAdd);
  }, [setToasts]);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-50 flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-md pointer-events-none"
    >
      {toasts.map((t) => {
        const isDestructive = t.variant === "destructive";
        const isSuccess = t.variant === "success";
        const isWarning = t.variant === "warning";

        return (
          <div
            key={t.id}
            role={isDestructive ? "alert" : "status"}
            className={cn(
              "pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-lg border p-3.5 shadow-md transition-all duration-150 animate-in fade-in-50 slide-in-from-bottom-2",
              isDestructive && "border-red-200 bg-white text-red-900",
              isSuccess && "border-emerald-200 bg-white text-slate-900",
              isWarning && "border-amber-200 bg-white text-slate-900",
              (!t.variant || t.variant === "default" || t.variant === "info") &&
                "border-slate-200 bg-white text-slate-900"
            )}
          >
            <div className="mt-0.5 shrink-0">
              {isSuccess && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
              {isDestructive && <AlertCircle className="h-4 w-4 text-red-600" aria-hidden="true" />}
              {isWarning && <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />}
              {(!t.variant || t.variant === "default" || t.variant === "info") && (
                <Info className="h-4 w-4 text-slate-700" aria-hidden="true" />
              )}
            </div>

            <div className="flex-1 space-y-0.5">
              {t.title && <p className="text-xs font-semibold leading-tight text-slate-900">{t.title}</p>}
              <p className="text-xs font-normal leading-normal text-slate-600">{t.description}</p>
            </div>

            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-900"
              aria-label="Close notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
