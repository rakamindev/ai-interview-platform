import { cn } from "@/lib/utils";
import { summarySentence, type FitGapSummary as Summary } from "@/lib/fitGap";

interface TileProps {
  label: string;
  value: number;
  hint: string;
  className?: string;
}

function Tile({ label, value, hint, className }: TileProps) {
  return (
    <div className={cn("rounded-lg border p-3", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums leading-none">{value}</dd>
      <dd className="mt-1 text-[11px] leading-tight text-muted-foreground">{hint}</dd>
    </div>
  );
}

export default function FitGapSummary({ summary }: { summary: Summary }) {
  return (
    <section aria-label="Summary" className="space-y-3">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Meets or exceeds" value={summary.meets} hint="Rated with evidence" />
        <Tile label="Below expected" value={summary.below} hint="Rated with evidence" />
        <Tile
          label="Needs your review"
          value={summary.review}
          hint="Briefly explored"
          className={summary.review > 0 ? "border-amber-300 bg-amber-50/60" : undefined}
        />
        <Tile label="Not covered" value={summary.notCovered} hint="Not in the interview" />
      </dl>
      <p className="text-sm text-muted-foreground">{summarySentence(summary)}</p>
    </section>
  );
}
