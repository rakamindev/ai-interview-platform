import { cn } from "@/lib/utils";

interface VoiceBarsProps {
  active: boolean;
  label: string;
  variant?: "ai" | "candidate";
  className?: string;
  // Real-time per-bar levels (0-1), e.g. from useAudioLevels. When provided
  // (and active), bar height tracks actual audio instead of the fixed CSS pulse.
  levels?: number[];
}

const MIN_BAR_HEIGHT = 4;
const MAX_BAR_HEIGHT = 32;

export default function VoiceBars({
  active,
  label,
  variant = "ai",
  className,
  levels
}: VoiceBarsProps) {
  const barCount = 5;
  const useRealLevels = active && levels && levels.length === barCount;

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="flex items-end gap-1 h-10">
        {Array.from({ length: barCount }).map((_, i) => (
          <div
            // oxlint-disable-next-line no-array-index-key
            key={i}
            className={cn(
              "w-1.5 rounded-full",
              variant === "ai" ? "bg-primary" : "bg-secondary",
              useRealLevels
                ? "transition-[height] duration-75"
                : active
                  ? "animate-voice-bar transition-all"
                  : "h-1 opacity-30 transition-all"
            )}
            style={
              useRealLevels
                ? {
                    height: `${MIN_BAR_HEIGHT + (levels?.[i] ?? 0) * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT)}px`
                  }
                : active
                  ? {
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: `${0.6 + (i % 3) * 0.2}s`
                    }
                  : undefined
            }
          />
        ))}
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
