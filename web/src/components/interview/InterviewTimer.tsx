import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface InterviewTimerProps {
  totalSeconds: number;
  // Time left on the server's clock (rejoined session). Takes precedence over totalSeconds.
  remainingSeconds?: number;
  onExpired?: () => void;
  running: boolean;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function InterviewTimer({ totalSeconds, remainingSeconds, onExpired, running }: InterviewTimerProps) {
  const start = remainingSeconds ?? totalSeconds;
  const [remaining, setRemaining] = useState(start);

  useEffect(() => {
    setRemaining(start);
  }, [start]);

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
        "font-mono text-sm font-medium tabular-nums",
        isUrgent ? "text-destructive" : isWarning ? "text-amber-500" : "text-foreground"
      )}
    >
      ⏱ {formatTime(remaining)}
    </span>
  );
}
