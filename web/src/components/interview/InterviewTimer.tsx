import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface InterviewTimerProps {
  totalSeconds: number;
  onExpired?: () => void;
  running: boolean;
  className?: string;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function InterviewTimer({
  totalSeconds,
  onExpired,
  running,
  className,
}: InterviewTimerProps) {
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    setRemaining(totalSeconds);
  }, [totalSeconds]);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) {
      onExpired?.();
      return;
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [running, remaining, onExpired]);

  const isWarning = remaining <= 300 && remaining > 60; // 1 to 5 min
  const isUrgent = remaining <= 60; // ≤1 min

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tabular-nums border transition-colors shadow-2xs",
        isUrgent
          ? "bg-rose-50 text-rose-700 border-rose-300 animate-pulse"
          : isWarning
          ? "bg-amber-50 text-amber-700 border-amber-300"
          : "bg-slate-100 text-slate-700 border-slate-200",
        className
      )}
    >
      <Clock className={cn("h-3.5 w-3.5", isUrgent ? "text-rose-600" : isWarning ? "text-amber-600" : "text-slate-500")} />
      <span>⏱ {formatTime(remaining)}</span>
    </div>
  );
}
