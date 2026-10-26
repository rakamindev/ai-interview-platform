import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { portfoliosApi } from "@/services/portfolios";
import { cn } from "@/lib/utils";
import { AlertTriangle, ArrowRight, RefreshCw, Trophy } from "lucide-react";
import type { VacancyMatch } from "@/types";

// Below this share of a vacancy's skills, the interview says too little about the candidate for that role.
const LOW_COVERAGE_PCT = 50;

interface VacancyMatchListProps {
  portfolioId: number;
  fitGapPath: (vacancyId: number) => string;
}

function MatchLine({ match }: { match: VacancyMatch }) {
  const s = match.summary;
  if (s.total === 0) return <span>No required skills defined yet</span>;

  const parts = [
    `${s.assessed}/${s.total} skills interviewed`,
    s.match > 0 && `${s.match} match`,
    s.exceed > 0 && `${s.exceed} exceed`,
    s.gap > 0 && `${s.gap} gap`,
  ].filter(Boolean);
  return <span>{parts.join(" · ")}</span>;
}

// F18: one interview, many possible roles — rank this company's vacancies by how much of each the
// interview covered (then by shortfall), instead of an unranked dropdown of titles.
export default function VacancyMatchList({ portfolioId, fitGapPath }: VacancyMatchListProps) {
  const [matches, setMatches] = useState<VacancyMatch[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    setMatches(null);
    portfoliosApi
      .vacancyMatches(portfolioId)
      .then((res) => setMatches(res.data.matches))
      .catch(() => setError(true));
  }, [portfolioId]);

  useEffect(load, [load]);

  if (error) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border p-4 text-sm">
        <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
        <span className="text-muted-foreground">Could not load vacancies.</span>
        <Button size="sm" variant="outline" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Try again
        </Button>
      </div>
    );
  }

  if (!matches) {
    return (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground space-y-3">
        <p>No vacancies yet. Create one to compare this candidate against a role.</p>
        <Button asChild size="sm" variant="outline">
          <Link to="/vacancies/new">Create vacancy</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {matches.map((m, i) => {
        const low = m.summary.total > 0 && m.summary.coverage_pct < LOW_COVERAGE_PCT;
        const best = i === 0 && m.summary.total > 0 && !low;
        return (
          <li key={m.vacancy_id} className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium break-words">{m.role_title}</span>
                {best && (
                  <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">
                    <Trophy className="h-3 w-3" aria-hidden /> Best covered
                  </span>
                )}
                {low && (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800">
                    <AlertTriangle className="h-3 w-3" aria-hidden /> Low coverage
                  </span>
                )}
              </div>
              <p className={cn("text-xs", low ? "text-amber-800" : "text-muted-foreground")}>
                <MatchLine match={m} />
              </p>
            </div>
            <Button asChild size="sm" variant={best ? "default" : "outline"}>
              <Link to={fitGapPath(m.vacancy_id)} aria-label={`View fit/gap for ${m.role_title}`}>
                Fit/Gap <ArrowRight className="h-3.5 w-3.5 ml-1" aria-hidden />
              </Link>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
