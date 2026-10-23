import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

interface AudioWaveformVisualizerProps {
  isActive: boolean;
  isAiSpeaking: boolean;
  audioLevel?: number; // 0 to 1
  className?: string;
}

export const AudioWaveformVisualizer: React.FC<AudioWaveformVisualizerProps> = ({
  isActive,
  isAiSpeaking,
  audioLevel = 0.6,
  className,
}) => {
  const barCount = 28;
  const bars = useMemo(() => Array.from({ length: barCount }, (_, i) => i), [barCount]);

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1.5 h-24 px-6 py-3 bg-card/90 backdrop-blur-xl rounded-2xl border border-border/80 shadow-md transition-colors",
        className
      )}
    >
      {bars.map((bar) => {
        // Calculate dynamic height based on position and activity
        const normalizedIndex = bar / (barCount - 1);
        const centerWeight = 1 - Math.abs(normalizedIndex - 0.5) * 1.5;
        const phase = bar * 0.35;
        const wave = Math.sin(phase + (isAiSpeaking ? Date.now() * 0.003 : 0));
        
        const dynamicHeight = isActive
          ? Math.max(10, (wave * 35 + 40) * audioLevel * Math.max(0.4, centerWeight))
          : 6;

        return (
          <div
            key={bar}
            className={cn(
              "w-1.5 rounded-full transition-all duration-100 ease-out",
              isAiSpeaking
                ? "bg-gradient-to-t from-primary via-teal-400 to-amber-300 shadow-[0_0_12px_rgba(1,149,159,0.4)] animate-pulse"
                : isActive
                ? "bg-gradient-to-t from-emerald-600 via-teal-400 to-green-300 shadow-[0_0_10px_rgba(52,211,153,0.4)]"
                : "bg-muted-foreground/30"
            )}
            style={{
              height: `${Math.min(72, dynamicHeight)}px`,
              animationDelay: `${bar * 30}ms`,
            }}
          />
        );
      })}
    </div>
  );
};

export default AudioWaveformVisualizer;
