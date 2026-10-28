import { Info } from "lucide-react";
import type { PortfolioSummary as Summary } from "@/lib/portfolio";

interface PortfolioSummaryProps {
  summary: Summary;
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: "warn" | "muted" }) {
  return (
    <div className="min-w-0">
      <p
        className={
          tone === "warn" && value > 0
            ? "text-2xl font-semibold tabular-nums text-amber-700"
            : tone === "muted"
              ? "text-2xl font-semibold tabular-nums text-muted-foreground"
              : "text-2xl font-semibold tabular-nums"
        }
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default function PortfolioSummary({ summary }: PortfolioSummaryProps) {
  return (
    <section aria-label="Review summary" className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat value={summary.assessed} label={`of ${summary.total} skills rated`} />
        <Stat value={summary.notAssessed} label="not assessed" tone="muted" />
        <Stat value={summary.needsReview} label="need your review" tone="warn" />
        <Stat value={summary.overridden} label="rated by you" />
      </div>
      <p className="mt-4 flex gap-2 border-t pt-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Ratings are an AI draft from the interview transcript. Quotes are checked against what the candidate said. A
          person makes the hiring decision — adjust any rating you disagree with.
        </span>
      </p>
    </section>
  );
}
