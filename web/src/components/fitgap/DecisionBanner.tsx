import { cn } from "@/lib/utils";
import type { HiringDecision } from "@/features/hiring/decision";

const VERDICT_LABEL = {
  advance: "Advance",
  hold: "Hold",
  decline: "Decline",
} as const;

const VERDICT_CLASS = {
  advance: "border-primary/30 bg-primary/5",
  hold: "border-amber-300 bg-amber-50",
  decline: "border-destructive/30 bg-destructive/5",
} as const;

interface DecisionBannerProps {
  decision: HiringDecision;
}

export default function DecisionBanner({ decision }: DecisionBannerProps) {
  const counts = [
    ["Match", decision.counts.match],
    ["Exceeds", decision.counts.exceed],
    ["Gap", decision.counts.gap],
    ["Not assessed", decision.counts.not_assessed],
  ] as const;

  return (
    <section className={cn("rounded-lg border p-4 sm:p-5 space-y-3", VERDICT_CLASS[decision.verdict])}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hiring decision</p>
          <h2 className="text-xl font-semibold tracking-tight">{VERDICT_LABEL[decision.verdict]}</h2>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {counts.map(([label, count]) => (
            <div key={label} className="rounded-md bg-background/80 px-3 py-2 min-w-[5.5rem]">
              <dt className="text-[11px] text-muted-foreground">{label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{count}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="text-sm leading-relaxed break-words">{decision.rationale}</p>
      {decision.blockingSkills.length > 0 && (
        <p className="text-xs text-muted-foreground break-words">
          Needs attention: {decision.blockingSkills.join(", ")}
        </p>
      )}
    </section>
  );
}
