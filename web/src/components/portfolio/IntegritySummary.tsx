import type { PortfolioSummary } from "@/types";

function pct(n: number, total: number) {
  return total > 0 ? (n / total) * 100 : 0;
}

export default function IntegritySummary({ summary }: { summary: PortfolioSummary }) {
  const { assessed, partially_assessed, not_assessed, discovered, total } = summary;
  const covered = assessed + partially_assessed;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Assessment coverage</span>
        <span className="text-sm text-muted-foreground">
          {covered} of {total} skill{total === 1 ? "" : "s"} assessed
        </span>
      </div>

      <div className="flex h-2 w-full overflow-hidden rounded-full bg-neutral-200">
        <div className="bg-teal-500" style={{ width: `${pct(assessed, total)}%` }} />
        <div className="bg-amber-400" style={{ width: `${pct(partially_assessed, total)}%` }} />
        <div className="bg-neutral-300" style={{ width: `${pct(not_assessed, total)}%` }} />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-teal-500" />{assessed} assessed</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />{partially_assessed} partial</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-neutral-300" />{not_assessed} not assessed</span>
        {discovered > 0 && (
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple-400" />{discovered} discovered</span>
        )}
      </div>

      {not_assessed > 0 && (
        <p className="rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
          {not_assessed} skill{not_assessed === 1 ? " was" : "s were"} not covered in this interview —
          {not_assessed === 1 ? " it is" : " they are"} shown as “not rated,” never scored low on absent evidence.
        </p>
      )}
    </div>
  );
}
