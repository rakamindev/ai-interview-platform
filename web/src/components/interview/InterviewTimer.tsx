import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";

interface InterviewTimerProps {
  totalSeconds: number;
  /** When the interview's time runs out; null until it has started. */
  deadlineMs: number | null;
  onExpired?: () => void;
  running: boolean;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function secondsUntil(deadlineMs: number) {
  return Math.max(Math.ceil((deadlineMs - Date.now()) / 1000), 0);
}

export default function InterviewTimer({
  totalSeconds,
  deadlineMs,
  onExpired,
  running,
}: InterviewTimerProps) {
  const [remaining, setRemaining] = useState(totalSeconds);

  // Reads the clock on every tick, so a pause or a throttled tab cannot make the timer fall behind.
  useEffect(() => {
    if (deadlineMs === null) {
      setRemaining(totalSeconds);
      return;
    }
    setRemaining(secondsUntil(deadlineMs));
    if (!running) return;
    const id = setInterval(() => setRemaining(secondsUntil(deadlineMs)), 1000);
    return () => clearInterval(id);
  }, [deadlineMs, totalSeconds, running]);

  useEffect(() => {
    if (running && deadlineMs !== null && remaining <= 0) onExpired?.();
  }, [running, deadlineMs, remaining, onExpired]);

  const isWarning = remaining <= 300; // ≤5 min
  const isUrgent = remaining <= 60;

  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-sm font-medium tabular-nums",
        isUrgent
          ? "bg-destructive/10 text-destructive"
          : isWarning
            ? "bg-rakamin-yellow/25 text-rakamin-charcoal"
            : "bg-muted text-foreground",
      )}
    >
      <Timer className="h-3.5 w-3.5" aria-hidden="true" />
      {formatTime(remaining)}
    </span>
  );
}
