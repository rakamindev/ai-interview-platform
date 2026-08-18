import { useEffect, useState } from "react";
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

export default function InterviewTimer({ totalSeconds, onExpired, running }: InterviewTimerProps) {
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    setRemaining(totalSeconds);
  }, [totalSeconds]);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) { onExpired?.(); return; }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [running, remaining, onExpired]);

  const isWarning = remaining <= 300; // ≤5 min
  const isUrgent = remaining <= 60;

  return (
    <span
      className={cn(
        "font-mono text-sm font-semibold tabular-nums px-2.5 py-1 rounded-full border shadow-2xs",
        isUrgent
          ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
          : isWarning
          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
          : "bg-slate-900 text-slate-200 border-slate-800"
      )}
    >
      ⏱ {formatTime(remaining)}
    </span>
  );

}
