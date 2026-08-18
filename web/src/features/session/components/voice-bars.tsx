import { cn } from "@/lib/utils";

interface VoiceBarsProps {
  active: boolean;
  label: string;
  variant?: "ai" | "candidate";
  className?: string;
}

export function VoiceBars({ active, label, variant = "ai", className }: VoiceBarsProps) {
  const barCount = 5;

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="flex h-10 items-end gap-1">
        {Array.from({ length: barCount }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-1.5 rounded-full transition-all",
              variant === "ai" ? "bg-primary" : "bg-warning",
              active ? "animate-voice-bar" : "h-1 opacity-30"
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
        ))}
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
