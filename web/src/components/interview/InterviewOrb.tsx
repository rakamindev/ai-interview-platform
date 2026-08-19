import { cn } from "@/lib/utils";

export type OrbState = "idle" | "ai" | "candidate";

interface InterviewOrbProps {
  state: OrbState;
  label: string;
  className?: string;
}

export default function InterviewOrb({ state, label, className }: InterviewOrbProps) {
  const active = state !== "idle";
  const colorVar = state === "candidate" ? "var(--secondary)" : "var(--primary)";

  const style = {
    "--orb-color": colorVar,
    background:
      "radial-gradient(circle at 35% 30%, hsl(var(--orb-color) / 0.95), hsl(var(--orb-color) / 0.5) 55%, hsl(var(--orb-color) / 0.1) 80%)",
    boxShadow: active
      ? "0 0 70px 14px hsl(var(--orb-color) / 0.55), 0 0 24px 6px hsl(var(--orb-color) / 0.8)"
      : "0 0 32px 6px hsl(var(--orb-color) / 0.3)",
  } as React.CSSProperties;

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div
        className={cn("h-28 w-28 rounded-full", active ? "animate-orb-pulse" : "animate-orb-breathe")}
        style={style}
      />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
