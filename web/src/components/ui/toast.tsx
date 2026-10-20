import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

type PushToast = (message: string, tone: ToastTone) => void;

const ToastContext = createContext<PushToast | null>(null);

let nextToastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback<PushToast>((message, tone) => {
    nextToastId += 1;
    setToasts((previous) => [...previous, { id: nextToastId, message, tone }]);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-96">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const { id, message, tone } = toast;
  const isError = tone === "error";

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(id), isError ? 6000 : 4000);
    return () => window.clearTimeout(timer);
  }, [id, isError, onDismiss]);

  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-lg border bg-card p-4 shadow-lg",
        isError ? "border-destructive/40" : "border-primary/30"
      )}
    >
      {isError ? (
        <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
      ) : (
        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      )}
      <p className="flex-1 text-sm leading-5 text-foreground">{message}</p>
      <button
        type="button"
        aria-label="Dismiss notification"
        className="-m-1 rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={() => onDismiss(id)}
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

export function useToast() {
  const push = useContext(ToastContext);

  return useMemo(
    () => ({
      success: (message: string) => push?.(message, "success"),
      error: (message: string) => push?.(message, "error"),
    }),
    [push]
  );
}
