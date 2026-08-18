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

  const isWarning = remaining <= 300; // 5 minutes left

  // The person watching this clock is being judged while they read it. Time
  // running out is worth flagging, so the last five minutes carry the yellow
  // attention accent — but it never turns red. Red is reserved for something
  // being broken, and a countdown styled like a failure makes a nervous
  // candidate perform worse at the exact moment they can least afford it.
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-sm font-medium tabular-nums",
        isWarning ? "text-secondary-foreground" : "text-foreground",
      )}
    >
      <Clock
        className={cn("h-3.5 w-3.5", isWarning ? "text-secondary" : "text-muted-foreground")}
        aria-hidden
      />
      <span className="sr-only">Time remaining:</span>
      {formatTime(remaining)}
      {isWarning && <span className="text-xs font-normal">left</span>}
    </span>
  );
}
