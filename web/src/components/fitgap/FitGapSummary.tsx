import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FitGapSummary as Summary } from "@/types";
import { RESULT_META, RESULT_ORDER } from "./resultMeta";

export default function FitGapSummary({ summary }: { summary: Summary }) {
  const { total } = summary;

  return (
    <section aria-labelledby="fitgap-summary-title" className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="fitgap-summary-title" className="text-sm font-semibold">
          At a glance
        </h2>
        <span className="text-xs text-muted-foreground">
          {total} required skill{total === 1 ? "" : "s"}
        </span>
      </div>

      {total > 0 && (
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
          {RESULT_ORDER.map((result) =>
            summary[result] > 0 ? (
              <span
                key={result}
                className={cn("h-full first:rounded-l-full last:rounded-r-full", RESULT_META[result].fill)}
                style={{ width: `${(summary[result] / total) * 100}%` }}
              />
            ) : null
          )}
        </div>
      )}

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {RESULT_ORDER.map((result) => {
          const { label, icon: Icon, pill } = RESULT_META[result];
          return (
            <li
              key={result}
              data-testid={`summary-${result}`}
              className={cn("flex items-center justify-between rounded-lg px-3 py-2 ring-1 ring-inset", pill)}
            >
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </span>
              <span className="text-base font-semibold tabular-nums">{summary[result]}</span>
            </li>
          );
        })}
      </ul>

      {(summary.needs_verification > 0 || summary.not_assessed > 0) && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-xs text-amber-900">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <p className="leading-relaxed">
            {summary.needs_verification > 0 && (
              <>
                <strong className="font-semibold">
                  {summary.needs_verification} rating{summary.needs_verification === 1 ? " rests" : "s rest"} on limited
                  evidence
                </strong>{" "}
                — verify before deciding.{" "}
              </>
            )}
            {summary.not_assessed > 0 && (
              <>
                <strong className="font-semibold">
                  {summary.not_assessed} skill{summary.not_assessed === 1 ? " was" : "s were"} not assessed
                </strong>
                ; missing evidence is not a gap.
              </>
            )}
          </p>
        </div>
      )}
    </section>
  );
}
