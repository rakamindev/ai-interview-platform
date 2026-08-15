import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface InterviewTimerProps {
  totalSeconds: number;
  /** Seconds already elapsed on the server when this component mounts.
   *  Lets the timer resume from the real remaining time on reconnect / page refresh. */
  elapsedOnMount?: number;
  onExpired?: () => void;
  running: boolean;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function InterviewTimer({ totalSeconds, elapsedOnMount = 0, onExpired, running }: InterviewTimerProps) {
  // Clamp to [0, totalSeconds] so stale elapsed data never shows negative time.
  const initialRemaining = Math.max(0, totalSeconds - elapsedOnMount);
  const [remaining, setRemaining] = useState(initialRemaining);
  // Track whether onExpired has already fired so we never double-call it.
  const expiredFiredRef = useRef(false);

  // If totalSeconds prop changes (unlikely but safe), re-compute remaining while
  // keeping the already-elapsed offset from the last server snapshot.
  useEffect(() => {
    const newRemaining = Math.max(0, totalSeconds - elapsedOnMount);
    setRemaining(newRemaining);
    expiredFiredRef.current = false;
  }, [totalSeconds, elapsedOnMount]);

  useEffect(() => {
    // Only tick when active. Pauses automatically during "reconnecting" / "connecting".
    if (!running) return;
    if (remaining <= 0) {
      if (!expiredFiredRef.current) {
        expiredFiredRef.current = true;
        onExpired?.();
      }
      return;
    }
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
