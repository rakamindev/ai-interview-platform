import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface VoiceBarsProps {
  active: boolean;
  label: string;
  variant?: "ai" | "candidate";
  className?: string;
}

export default function VoiceBars({
  active,
  label,
  variant = "ai",
  className,
}: VoiceBarsProps) {
  // 9 bars shaped like a natural bell-curve audio frequency spectrum
  const bars = useMemo(() => {
    return [
      { delay: "0.15s", duration: "0.75s", minH: "6px", maxH: "18px" },
      { delay: "0.05s", duration: "0.65s", minH: "8px", maxH: "26px" },
      { delay: "0.20s", duration: "0.85s", minH: "10px", maxH: "34px" },
      { delay: "0.10s", duration: "0.70s", minH: "12px", maxH: "42px" },
      { delay: "0.00s", duration: "0.60s", minH: "14px", maxH: "48px" },
      { delay: "0.12s", duration: "0.72s", minH: "12px", maxH: "42px" },
      { delay: "0.25s", duration: "0.80s", minH: "10px", maxH: "34px" },
      { delay: "0.08s", duration: "0.68s", minH: "8px", maxH: "26px" },
      { delay: "0.18s", duration: "0.78s", minH: "6px", maxH: "18px" },
    ];
  }, []);

  const isAi = variant === "ai";

  return (
    <div
      role="status"
      aria-label={`${label} (${active ? "aktif" : "siaga"})`}
      className={cn(
        "flex flex-col items-center gap-3.5 p-4 rounded-2xl transition-all duration-300",
        active
          ? isAi
            ? "bg-teal-500/5 ring-1 ring-teal-500/20 shadow-sm"
            : "bg-emerald-500/5 ring-1 ring-emerald-500/20 shadow-sm"
          : "bg-transparent",
        className
      )}
    >
      {/* Waveform Visualization Container */}
      <div className="flex items-center justify-center gap-1.5 h-14 px-3">
        {bars.map((bar, i) => (
          <span
            key={i}
            className={cn(
              "w-1.5 rounded-full transition-all duration-200",
              isAi
                ? active
                  ? "bg-gradient-to-t from-teal-600 to-cyan-400 shadow-[0_0_8px_rgba(20,184,166,0.5)] animate-voice-bar"
                  : "bg-teal-700/25 h-1.5"
                : active
                ? "bg-gradient-to-t from-emerald-600 to-teal-300 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-voice-bar"
                : "bg-emerald-700/25 h-1.5"
            )}
            style={
              active
                ? {
                    animationDelay: bar.delay,
                    animationDuration: bar.duration,
                    height: bar.maxH,
                  }
                : {
                    height: "6px",
                  }
            }
          />
        ))}
      </div>

      {/* Status Label with Active Beacon */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          {active && (
            <span
              className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                isAi ? "bg-teal-400" : "bg-emerald-400"
              )}
            />
          )}
          <span
            className={cn(
              "relative inline-flex rounded-full h-2 w-2",
              active
                ? isAi
                  ? "bg-teal-500"
                  : "bg-emerald-500"
                : "bg-muted-foreground/30"
            )}
          />
        </span>
        <span
          className={cn(
            "text-xs font-medium tracking-wide transition-colors",
            active ? "text-foreground font-semibold" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
