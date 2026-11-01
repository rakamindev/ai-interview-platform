import { Loader2, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

// Whose turn it is; only one voice is ever shown so the candidate always knows when to talk.
export type VoiceOrbMode = "connecting" | "waiting" | "ai" | "candidate" | "muted" | "wrapping";

const TEAL_SHADOW =
  "shadow-[0_24px_60px_-20px_rgb(33_102_111/0.55),inset_0_-10px_30px_rgb(33_102_111/0.25)]";
// Yellow stays on its own: blending it with teal turns olive.
const WARM_SHADOW =
  "shadow-[0_24px_60px_-20px_rgb(245_196_81/0.7),inset_0_-10px_30px_rgb(41_41_41/0.12)]";

const MODES: Record<
  VoiceOrbMode,
  { label: string; core: string; shadow?: string; ripple?: string }
> = {
  connecting: {
    label: "Connecting...",
    core: "radial-gradient(circle at 35% 30%, rgb(var(--rakamin-white)), rgb(var(--rakamin-light-cyan)) 60%, rgb(var(--rakamin-teal) / 0.35))",
  },
  waiting: {
    label: "Listening...",
    core: "radial-gradient(circle at 35% 30%, rgb(var(--rakamin-white)), rgb(var(--rakamin-teal) / 0.45) 55%, rgb(var(--rakamin-dark-teal) / 0.7))",
  },
  ai: {
    label: "AI is speaking",
    core: "radial-gradient(circle at 35% 30%, rgb(var(--rakamin-light-cyan)), rgb(var(--rakamin-teal)) 50%, rgb(var(--rakamin-dark-teal)))",
    ripple: "bg-rakamin-teal/30",
  },
  candidate: {
    label: "Your turn — go ahead",
    core: "radial-gradient(circle at 35% 30%, rgb(var(--rakamin-cream)), rgb(var(--rakamin-yellow)) 60%)",
    shadow: WARM_SHADOW,
    ripple: "bg-rakamin-yellow/40",
  },
  muted: {
    label: "You're muted — unmute to answer",
    core: "radial-gradient(circle at 35% 30%, rgb(var(--rakamin-white)), rgb(var(--rakamin-gray) / 0.35) 55%, rgb(var(--rakamin-gray) / 0.7))",
  },
  wrapping: {
    label: "Wrapping up...",
    core: "radial-gradient(circle at 35% 30%, rgb(var(--rakamin-light-cyan)), rgb(var(--rakamin-teal)) 50%, rgb(var(--rakamin-dark-teal)))",
    ripple: "bg-rakamin-teal/20",
  },
};

export default function VoiceOrb({ mode }: { mode: VoiceOrbMode }) {
  const { label, core, shadow = TEAL_SHADOW, ripple } = MODES[mode];
  const speaking = !!ripple;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative flex h-44 w-44 items-center justify-center sm:h-52 sm:w-52">
        {/* Ripples only while someone is speaking; hidden when reduced motion is requested */}
        {speaking && (
          <>
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-6 rounded-full animate-ping [animation-duration:2.2s] motion-reduce:hidden",
                ripple,
              )}
            />
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-10 rounded-full animate-ping [animation-delay:0.7s] [animation-duration:2.2s] motion-reduce:hidden",
                ripple,
              )}
            />
          </>
        )}

        {/* Orb core */}
        <div
          data-testid="voice-orb"
          data-mode={mode}
          className={cn(
            "relative flex h-full w-full items-center justify-center rounded-full ring-8 ring-white/70",
            shadow,
            mode === "waiting" && "animate-pulse motion-reduce:animate-none",
          )}
          style={{ backgroundImage: core }}
        >
          {/* Soft inner halo */}
          <span
            aria-hidden="true"
            className="absolute inset-[18%] rounded-full border-2 border-white/50 shadow-[0_0_30px_rgb(255_255_255/0.45)]"
          />
          {mode === "connecting" && (
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          )}
          {mode === "muted" && (
            <MicOff className="h-8 w-8 text-rakamin-charcoal/70" aria-hidden="true" />
          )}
        </div>
      </div>

      <p
        aria-live="polite"
        className="rounded-full border bg-card/80 px-4 py-1.5 text-sm font-medium shadow-sm backdrop-blur"
      >
        {label}
      </p>
    </div>
  );
}
