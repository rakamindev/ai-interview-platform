import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface InterviewTimerProps {
  totalSeconds: number;
  onExpired?: () => void;
  running: boolean;
}

function formatTime(s: number) {
  const safe = Math.max(0, s);
  const m = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

const WARNING_AT = 300; // 5 minutes
const URGENT_AT = 60;

/**
 * Time left, as a ring rather than a number alone.
 *
 * A candidate under pressure reads a shape faster than four digits, and the
 * digits alone gave no sense of how much of the session was gone. Colour is
 * never the only signal: the ring shortens, and the remaining time is announced
 * to screen readers when it crosses each threshold.
 */
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

  const isWarning = remaining <= WARNING_AT;
  const isUrgent = remaining <= URGENT_AT;
  const fraction = totalSeconds > 0 ? Math.max(0, Math.min(1, remaining / totalSeconds)) : 0;

  const radius = 9;
  const circumference = 2 * Math.PI * radius;

  const tone = isUrgent ? "text-destructive" : isWarning ? "text-warning" : "text-primary";

  return (
    <div
      className="flex items-center gap-2"
      // Only the minute crossings are announced, not every tick.
      aria-live={isUrgent ? "assertive" : "off"}
    >
      <svg viewBox="0 0 24 24" className={cn("h-5 w-5 -rotate-90", tone)} aria-hidden="true">
        <circle cx="12" cy="12" r={radius} fill="none" strokeWidth="2.5" className="stroke-border" />
        <circle
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
      </svg>

      <span className={cn("font-mono text-sm font-medium tabular-nums", tone)}>
        {formatTime(remaining)}
      </span>
      <span className="sr-only">{Math.ceil(remaining / 60)} minutes remaining</span>
    </div>
  );
}
