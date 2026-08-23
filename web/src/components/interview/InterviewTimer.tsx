import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Timer } from "lucide-react";

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
    // oxlint-disable-next-line react/no-deriving-state-in-effects
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

  const isWarning = remaining <= 300; // ≤5 min
  const isUrgent = remaining <= 60;

  return (
    <span
      className={cn(
        "font-mono text-sm font-medium tabular-nums flex items-center gap-2",
        isUrgent ? "text-destructive" : isWarning ? "text-amber-500" : "text-foreground"
      )}
    >
      <Timer className="h-4 w-4" /> {formatTime(remaining)}
    </span>
  );
}
