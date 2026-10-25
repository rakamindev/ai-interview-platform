import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface InterviewTimerProps {
  totalSeconds: number;
  remainingSeconds?: number;
  onExpired?: () => void;
  running: boolean;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function InterviewTimer({
  totalSeconds,
  remainingSeconds,
  onExpired,
  running,
}: InterviewTimerProps) {
  const initialTime = typeof remainingSeconds === "number" ? remainingSeconds : totalSeconds;
  const [remaining, setRemaining] = useState(initialTime);

  const anchorRef = useRef<{ baseSeconds: number; timestamp: number }>({
    baseSeconds: initialTime,
    timestamp: performance.now(),
  });

  // Re-anchor whenever remainingSeconds from server changes (initial load or WebSocket calibration)
  useEffect(() => {
    if (typeof remainingSeconds === "number") {
      anchorRef.current = {
        baseSeconds: remainingSeconds,
        timestamp: performance.now(),
      };
      setRemaining(remainingSeconds);
    }
  }, [remainingSeconds]);

  // When totalSeconds changes (if remainingSeconds is unset)
  useEffect(() => {
    if (remainingSeconds === undefined) {
      anchorRef.current = {
        baseSeconds: totalSeconds,
        timestamp: performance.now(),
      };
      setRemaining(totalSeconds);
    }
  }, [totalSeconds, remainingSeconds]);

  // Monotonic timer tick calculation — immune to background tab throttling drift
  useEffect(() => {
    if (!running) {
      anchorRef.current.timestamp = performance.now();
      return;
    }

    const updateTimer = () => {
      const elapsedSeconds = Math.floor((performance.now() - anchorRef.current.timestamp) / 1000);
      const currentRemaining = Math.max(0, anchorRef.current.baseSeconds - elapsedSeconds);
      setRemaining(currentRemaining);

      if (currentRemaining <= 0) {
        onExpired?.();
      }
    };

    updateTimer();
    const intervalId = setInterval(updateTimer, 500);

    return () => clearInterval(intervalId);
  }, [running, onExpired]);

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
