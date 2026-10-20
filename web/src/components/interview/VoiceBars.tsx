import { cn } from "@/lib/utils";

interface VoiceBarsProps {
  active: boolean;
  variant?: "ai" | "candidate";
  className?: string;
}

export default function VoiceBars({ active, variant = "ai", className }: VoiceBarsProps) {
  const barCount = 5;

  return (
    <div className={cn("flex h-10 items-end justify-center gap-1", className)}>
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-1.5 rounded-full transition-all",
            variant === "ai" ? "bg-primary" : "bg-secondary",
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
  );
}
