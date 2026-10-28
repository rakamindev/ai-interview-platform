import { useState, useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
  onClose?: () => void;
}

export function Toast({ message, type = "success", duration = 3000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!visible) return null;

  return (
    <div className={cn(
      "fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all animate-in fade-in slide-in-from-bottom-4",
      type === "success" && "bg-emerald-600 text-white",
      type === "error" && "bg-destructive text-destructive-foreground",
      type === "info" && "bg-primary text-primary-foreground"
    )}>
      {type === "success" && <CheckCircle2 className="h-4 w-4" />}
      <span>{message}</span>
      <button onClick={() => { setVisible(false); onClose?.(); }} className="ml-2 hover:opacity-80">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
