import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface InterviewTimerProps {
  totalSeconds: number;
  onExpired?: () => void;
  running: boolean;
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

  const isWarning = remaining <= 300;
  const isUrgent = remaining <= 60;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-xs sm:text-sm font-medium tabular-nums rounded-full border px-2.5 py-1",
        isUrgent
          ? "text-destructive border-destructive/30 bg-destructive/5"
          : isWarning
            ? "text-amber-600 border-amber-200 bg-amber-50"
            : "text-foreground border-border bg-white"
      )}
    >
      <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      {formatTime(remaining)}
    </span>
  );
}
