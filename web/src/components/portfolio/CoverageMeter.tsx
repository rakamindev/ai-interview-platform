import { cn } from "@/lib/utils";
import { COVERAGE_STATE_WIDTH, COVERAGE_STATE_COLOR, COVERAGE_STATE_LABELS } from "@/utils/constants";

interface CoverageMeterProps {
  state: string;
  probeCount: number;
}

export default function CoverageMeter({ state, probeCount }: CoverageMeterProps) {
  const width = COVERAGE_STATE_WIDTH[state] ?? 0;
  const color = COVERAGE_STATE_COLOR[state] ?? "bg-neutral-200";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-[120px] overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${width}%` }} />
      </div>
      <span className="text-[11px] text-muted-foreground">
        {COVERAGE_STATE_LABELS[state] ?? state} · {probeCount} probe{probeCount === 1 ? "" : "s"}
      </span>
    </div>
  );
}
