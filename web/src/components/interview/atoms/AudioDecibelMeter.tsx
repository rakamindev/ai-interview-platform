import React from "react";
import { cn } from "@/lib/utils";

export interface AudioDecibelMeterProps {
  level: number; // 0 - 100
  active?: boolean;
  label?: string;
  className?: string;
}

const BAR_THRESHOLDS = [5, 25, 45, 65, 85];
const BAR_HEIGHTS = ["h-2.5", "h-3.5", "h-4.5", "h-5.5", "h-7"];

export function AudioDecibelMeter({
  level,
  active = true,
  label,
  className,
}: AudioDecibelMeterProps) {
  // Normalize level to 0-100 clamped
  const normalizedLevel = Math.max(0, Math.min(100, Math.round(level)));

  return (
    <div
      className={cn("flex flex-col items-center gap-2", className)}
      data-testid="audio-decibel-meter"
    >
      <div
        className="flex items-end gap-1.5 h-8 px-2 py-1 rounded bg-neutral-50 border border-neutral-100"
        role="meter"
        aria-valuenow={normalizedLevel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || "Audio level meter"}
      >
        {BAR_THRESHOLDS.map((threshold, idx) => {
          const isFilled = active && normalizedLevel >= threshold;
          return (
            <div
              key={idx}
              data-testid={`meter-bar-${idx}`}
              className={cn(
                "w-1.5 rounded-full transition-colors duration-150 ease-out",
                BAR_HEIGHTS[idx],
                isFilled
                  ? "bg-emerald-500"
                  : "bg-neutral-200"
              )}
            />
          );
        })}
      </div>
      {label && (
        <span className="text-xs font-medium text-neutral-500">{label}</span>
      )}
    </div>
  );
}

export default AudioDecibelMeter;
