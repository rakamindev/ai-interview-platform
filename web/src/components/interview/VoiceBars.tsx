import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface VoiceBarsProps {
  active: boolean;
  label: string;
  variant?: "ai" | "candidate";
  className?: string;
  analyserNode?: AnalyserNode | null;
}

export default function VoiceBars({
  active,
  label,
  variant = "ai",
  className,
  analyserNode,
}: VoiceBarsProps) {
  const barCount = 5;
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!analyserNode || !active) {
      barRefs.current.forEach((bar) => {
        if (bar) {
          bar.style.transform = "scaleY(1)";
        }
      });
      return;
    }

    let rafId: number;
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const multipliers = [0.6, 1.0, 1.3, 0.9, 0.5];

    const update = () => {
      analyserNode.getByteFrequencyData(dataArray);

      let sum = 0;
      let max = 0;
      for (let i = 0; i < bufferLength; i++) {
        const val = dataArray[i];
        sum += val;
        if (val > max) max = val;
      }
      const avg = sum / (bufferLength || 1);
      const norm = Math.min(1, Math.max(0, (avg * 1.5 + max * 0.5) / 255));

      barRefs.current.forEach((bar, i) => {
        if (bar) {
          const mult = multipliers[i % multipliers.length];
          const scale = Math.max(0.15, Math.min(3.5, 0.2 + norm * 3.3 * mult));
          bar.style.transform = `scaleY(${scale.toFixed(3)})`;
        }
      });

      rafId = requestAnimationFrame(update);
    };

    rafId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(rafId);
      barRefs.current.forEach((bar) => {
        if (bar) {
          bar.style.transform = "scaleY(1)";
        }
      });
    };
  }, [analyserNode, active]);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="flex items-end gap-1 h-10">
        {Array.from({ length: barCount }).map((_, i) => {
          const hasAnalyser = Boolean(analyserNode);
          return (
            <div
              key={i}
              ref={(el) => {
                barRefs.current[i] = el;
              }}
              data-voice-bar
              className={cn(
                "w-1.5 rounded-full origin-bottom transition-colors",
                variant === "ai" ? "bg-primary" : "bg-secondary",
                active
                  ? "animate-voice-bar h-2"
                  : "h-1 opacity-30"
              )}
              style={
                active
                  ? hasAnalyser
                    ? {
                        animation: "none",
                        transition: "transform 60ms ease-out",
                      }
                    : {
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: `${0.6 + (i % 3) * 0.2}s`,
                      }
                  : undefined
              }
            />
          );
        })}
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

