import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface InterviewTimerProps {
  totalSeconds: number;
  startedAt?: string | null;
  onExpired?: () => void;
  running: boolean;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function InterviewTimer({ totalSeconds, startedAt, onExpired, running }: InterviewTimerProps) {
  const calculateRemaining = useCallback(() => {
    if (!startedAt) return totalSeconds;
    const startTime = new Date(startedAt).getTime();
    if (isNaN(startTime)) return totalSeconds;
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    return Math.max(0, totalSeconds - elapsedSeconds);
  }, [totalSeconds, startedAt]);

  const [remaining, setRemaining] = useState(calculateRemaining);

  useEffect(() => {
    setRemaining(calculateRemaining());
  }, [calculateRemaining]);

  useEffect(() => {
    if (!running) return;

    const tick = () => {
      const currentRemaining = calculateRemaining();
      setRemaining(currentRemaining);
      if (currentRemaining <= 0) {
        onExpired?.();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [running, calculateRemaining, onExpired]);

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
