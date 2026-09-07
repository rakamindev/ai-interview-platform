import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import LevelBadge from "@/components/portfolio/LevelBadge";
import ConfidenceIndicator, { normalizeConfidence } from "@/components/portfolio/ConfidenceIndicator";
import HiringDecisionPanel from "@/components/portfolio/HiringDecisionPanel";
import { sessionsApi } from "@/services/sessions";
import { parseLevel } from "@/utils/constants";
import { cn } from "@/lib/utils";
import { AlertTriangle, ArrowLeft, FileText, Zap } from "lucide-react";
import type { Portfolio, PortfolioSkill, Session } from "@/types";

/**
 * The page a hiring manager opens.
 *
 * They are not a daily user. They come to this product a handful of times per
 * role and need one screen they can trust: what the interview found, how much
 * of it is worth acting on, and the decision, in that order. Everything else in
 * the product is built for the assessor who ran the session.
 *
 * The design rule here is that the caveats come before the numbers, not after.
 * A reader who stops at the top of this page should already know how far to
 * trust the rest of it.
 */
export default function ResultPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [roleTitle, setRoleTitle] = useState("");
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([sessionsApi.get(Number(sessionId)), sessionsApi.getPortfolio(Number(sessionId))])
      .then(([sRes, pRes]) => {
        setSession(sRes.data.session);
        setRoleTitle((sRes.data as any).session?.assessment?.name ?? "");
        setPortfolio((pRes.data as any).portfolio ?? null);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          There is no result for this session yet. A portfolio is generated once the interview ends.
        </p>
      </div>
    );
  }

  const skills: PortfolioSkill[] = portfolio.skills ?? [];
  const overrides = portfolio.overrides ?? [];
  const overrideFor = (skillId: number) => overrides.find((o) => o.portfolio_skill_id === skillId);

  const configured = skills.filter((s) => !s.is_discovered);
  const discovered = skills.filter((s) => s.is_discovered);

  const unassessed = configured.filter((s) => s.ai_level == null);
  const lowConfidence = configured.filter(
    (s) => s.ai_level != null && normalizeConfidence(s.ai_confidence) === "low"
  );
  const solid = configured.filter(
    (s) => s.ai_level != null && normalizeConfidence(s.ai_confidence) === "high"
  );

  // The number a reader should see before any level: how much of this rating is
  // actually worth acting on. Presenting five levels without it invites someone
  // to treat a thin reading and a well-evidenced one as the same fact.
  const caveats = unassessed.length + lowConfidence.length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Link
            to={`/assessments/${id}/invite`}
            className="mt-1 text-muted-foreground hover:text-foreground"
            aria-label="Back to candidates"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="break-words text-xl font-semibold">
              {session?.candidate_name || "Candidate"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {roleTitle}
              {session?.duration_seconds
                ? ` · ${Math.round(session.duration_seconds / 60)} minute interview`
                : ""}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/assessments/${id}/sessions/${sessionId}/transcript`}>
              <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Read the transcript
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={`/assessments/${id}/sessions/${sessionId}/portfolio`}>Full portfolio</Link>
          </Button>
        </div>
      </div>

      {/* Read this before the numbers. */}
      {caveats > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-medium text-amber-900">
              {caveats} of {configured.length} skills are not settled
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
              {unassessed.length > 0 && (
                <>
                  <strong>{unassessed.length}</strong> the interview never reached
                  {lowConfidence.length > 0 ? ", and " : ". "}
                </>
              )}
              {lowConfidence.length > 0 && (
                <>
                  <strong>{lowConfidence.length}</strong> rated on too little evidence to rely on.{" "}
                </>
              )}
              Neither is a weakness in the candidate. Both are gaps in what was asked.
            </p>
          </div>
        </div>
      )}

      {caveats === 0 && solid.length === configured.length && configured.length > 0 && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Every skill on the agenda was covered with enough evidence to rate confidently.
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">What the interview found</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ul className="divide-y">
            {configured.map((skill) => {
              const override = overrideFor(skill.id);
              const level = override?.override_level ?? parseLevel(skill.ai_level);
              const notAssessed = !override && skill.ai_level == null;

              return (
                <li key={skill.id} className="flex flex-wrap items-center gap-3 py-3">
                  {notAssessed ? (
                    <span className="inline-flex w-14 shrink-0 flex-col items-center justify-center rounded border border-dashed border-neutral-400 bg-neutral-100 px-2 py-1.5 text-sm font-semibold text-neutral-500">
                      <span>&ndash;</span>
                    </span>
                  ) : (
                    <LevelBadge level={level as number} size="sm" className="w-14 shrink-0" />
                  )}

                  <span className="min-w-0 flex-1 break-words text-sm font-medium">
                    {skill.skill_label}
                  </span>

                  {notAssessed ? (
                    <span className="text-xs text-neutral-600">Never reached in the interview</span>
                  ) : override ? (
                    <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-700">
                      Assessor set this
                    </span>
                  ) : (
                    <ConfidenceIndicator
                      confidence={skill.ai_confidence}
                      evidenceCount={skill.evidence?.length}
                    />
                  )}
                </li>
              );
            })}
          </ul>

          {discovered.length > 0 && (
            <>
              <Separator className="my-3" />
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Zap className="h-3 w-3 text-amber-500" aria-hidden="true" />
                Raised by the candidate, not asked for
              </p>
              <ul className="space-y-1.5">
                {discovered.map((s) => (
                  <li key={s.id} className={cn("flex flex-wrap items-center gap-2 text-sm")}>
                    <span className="font-medium">{s.skill_label}</span>
                    {s.ai_level != null && (
                      <span className="text-muted-foreground">L{parseLevel(s.ai_level)}</span>
                    )}
                    <ConfidenceIndicator
                      confidence={s.ai_confidence}
                      evidenceCount={s.evidence?.length}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <HiringDecisionPanel portfolioId={portfolio.id} />
    </div>
  );
}
