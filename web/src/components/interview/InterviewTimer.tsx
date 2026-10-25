import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface InterviewTimerProps {
  deadlineAt: string;
  initialRemainingSeconds: number;
  onExpired?: () => void;
  running: boolean;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function remainingFromDeadline(deadlineAt: string, fallback: number) {
  const deadlineMs = Date.parse(deadlineAt);
  if (Number.isNaN(deadlineMs)) return Math.max(fallback, 0);
  return Math.max(Math.ceil((deadlineMs - Date.now()) / 1000), 0);
}

export default function InterviewTimer({
  deadlineAt,
  initialRemainingSeconds,
  onExpired,
  running,
}: InterviewTimerProps) {
  const [remaining, setRemaining] = useState(() =>
    remainingFromDeadline(deadlineAt, initialRemainingSeconds)
  );
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    setRemaining(remainingFromDeadline(deadlineAt, initialRemainingSeconds));
  }, [deadlineAt, initialRemainingSeconds]);

  useEffect(() => {
    if (!running) return;

    const update = () => {
      const next = remainingFromDeadline(deadlineAt, initialRemainingSeconds);
      setRemaining(next);
      if (next === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpired?.();
      }
    };

    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [deadlineAt, initialRemainingSeconds, running, onExpired]);

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
