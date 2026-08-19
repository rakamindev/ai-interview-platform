import { cn } from "@/shared/lib/utils";

interface WaveformSignatureProps {
  barCount?: number;
  className?: string;
}

/**
 * Ambient brand signature — idle-pulsing bars in the teal/yellow duotone.
 * Reuses the `voice-bar` keyframe already defined for the live interview UI
 * (see components/interview/VoiceBars.tsx) so auth and other brand surfaces
 * read as the same product as the voice-interview experience, instead of a
 * generic decorative gradient.
 */
export default function WaveformSignature({ barCount = 24, className }: WaveformSignatureProps) {
  return (
    <div className={cn("flex items-end gap-1 h-12", className)} aria-hidden="true">
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className={cn("w-1 rounded-full animate-voice-bar", i % 3 === 0 ? "bg-secondary" : "bg-white/70")}
          style={{
            animationDelay: `${(i % 8) * 0.12}s`,
            animationDuration: `${0.9 + (i % 4) * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}
