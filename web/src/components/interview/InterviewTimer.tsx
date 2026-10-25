import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface InterviewTimerProps {
  totalSeconds: number;
  onExpired?: () => void;
  running: boolean;
  onTimeWarning?: (minutesRemaining: number) => void;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function InterviewTimer({ totalSeconds, onExpired, running, onTimeWarning }: InterviewTimerProps) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const [warningSent, setWarningSent] = useState<Set<number>>(new Set());

  useEffect(() => {
    setRemaining(totalSeconds);
    setWarningSent(new Set());
  }, [totalSeconds]);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) { onExpired?.(); return; }

    // Send warnings at specific thresholds
    const minutesLeft = Math.ceil(remaining / 60);
    if ((minutesLeft === 10 || minutesLeft === 5 || minutesLeft === 1) && !warningSent.has(minutesLeft)) {
      setWarningSent((prev) => new Set(prev).add(minutesLeft));
      onTimeWarning?.(minutesLeft);
    }

    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [running, remaining, onExpired, onTimeWarning, warningSent]);

  const isCaution = remaining <= 600; // ≤10 min
  const isWarning = remaining <= 300; // ≤5 min
  const isUrgent = remaining <= 60;

  return (
    <span
      className={cn(
        "font-mono text-sm font-medium tabular-nums",
        isUrgent ? "text-destructive" : isWarning ? "text-amber-500" : isCaution ? "text-amber-600/70" : "text-foreground"
      )}
    >
      ⏱ {formatTime(remaining)}
    </span>
  );
}
