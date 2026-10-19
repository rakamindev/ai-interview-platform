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
  const barCount = 7;

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl border p-6 sm:p-8",
          variant === "ai"
            ? "border-primary/20 bg-primary-muted/50"
            : "border-border bg-white"
        )}
      >
        <div className="flex items-end gap-1 sm:gap-1.5 h-12 sm:h-14">
          {Array.from({ length: barCount }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-1.5 sm:w-2 rounded-full transition-all",
                variant === "ai" ? "bg-primary" : "bg-primary/70",
                active ? "animate-voice-bar" : "h-1.5 opacity-30"
              )}
              style={
                active
                  ? {
                      animationDelay: `${i * 0.08}s`,
                      animationDuration: `${0.55 + (i % 3) * 0.18}s`,
                    }
                  : undefined
              }
            />
          ))}
        </div>
      </div>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
  );
}
