import { cn } from "@/lib/utils";

interface VoiceBarsProps {
  active: boolean;
  label: string;
  variant?: "ai" | "candidate";
  level?: number;
  className?: string;
}

const BAR_WEIGHTS = [0.55, 0.85, 1.0, 0.8, 0.6];

export default function VoiceBars({
  active,
  label,
  variant = "ai",
  level,
  className,
}: VoiceBarsProps) {
  const barCount = 5;
  const hasLiveLevel = typeof level === "number";

  return (
    <div className={cn("flex flex-col items-center gap-2.5", className)}>
      <div className="flex items-end gap-1.5 h-10">
        {Array.from({ length: barCount }).map((_, i) => {
          if (hasLiveLevel) {
            const weighted = Math.min(100, Math.round(level * BAR_WEIGHTS[i]));
            const heightPx = active ? Math.max(6, Math.round((weighted / 100) * 36)) : 4;
            return (
              <div
                key={i}
                className={cn(
                  "w-2 rounded-full transition-all duration-75",
                  variant === "ai" ? "bg-primary" : "bg-emerald-500",
                  !active && "opacity-30"
                )}
                style={{ height: `${heightPx}px` }}
              />
            );
          }

          return (
            <div
              key={i}
              className={cn(
                "w-1.5 rounded-full transition-all",
                variant === "ai" ? "bg-primary" : "bg-emerald-500",
                active ? "animate-voice-bar" : "h-1.5 opacity-30"
              )}
              style={
                active
                  ? {
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: `${0.6 + (i % 3) * 0.2}s`,
                    }
                  : undefined
              }
            />
          );
        })}
      </div>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
    </div>
  );
}
