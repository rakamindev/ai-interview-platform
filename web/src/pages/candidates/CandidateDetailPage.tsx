import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, FileText, Loader2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { assessmentsApi } from "@/services/assessments";
import { vacanciesApi } from "@/services/vacancies";
import { candidatesApi, type MatchEntry } from "@/services/candidates";
import type { Assessment, AssessorOverride, Portfolio, SkillComparison, Vacancy } from "@/types";

function StatusBadge({ status, endReason }: { status?: string; endReason?: string | null }) {
  if (status === "active") return <span className="text-xs text-primary">Live now</span>;
  if (status === "ended" && endReason === "error")
    return <span className="text-xs text-destructive">Failed</span>;
  if (status === "ended") return <span className="text-xs text-muted-foreground">Completed</span>;
  return <span className="text-xs text-muted-foreground">Awaiting</span>;
}

export default function CandidateDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [portfolioStatus, setPortfolioStatus] = useState<string>("loading");
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [match, setMatch] = useState<MatchEntry | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);

  useEffect(() => {
    const id = Number(sessionId);
    sessionsApi
      .get(id)
      .then((res) => {
        setSession(res.data.session);
        const assessmentId = res.data.session.assessment_id;
        return assessmentsApi.get(assessmentId);
      })
      .then((res) => setAssessment(res.data.assessment))
      .catch(() => setSession(null));
    sessionsApi
      .getPortfolio(id)
      .then((res) => {
        const data = res.data as any;
        if (data.portfolio) {
          setPortfolio(data.portfolio);
          setPortfolioStatus("complete");
          const overrideMap: Record<number, AssessorOverride> = {};
          data.portfolio.overrides.forEach((o: AssessorOverride) => {
            overrideMap[o.portfolio_skill_id] = o;
          });
          setOverrides(overrideMap);
        } else {
          setPortfolioStatus(data.status ?? "none");
        }
      })
      .catch(() => setPortfolioStatus("none"));
    vacanciesApi.list({ per_page: 100 }).then((res) => setVacancies(res.data.vacancies)).catch(() => {});
  }, [sessionId]);

  const loadMatch = (vacancyId: string) => {
    if (!vacancyId) {
      setMatch(null);
      return;
    }
    setMatchLoading(true);
    candidatesApi
      .matches(Number(vacancyId))
      .then((res) => {
        const entry = res.data.matches.find((m) => m.session_id === Number(sessionId));
        setMatch(entry ?? null);
      })
      .catch(() => setMatch(null))
      .finally(() => setMatchLoading(false));
  };

  const handleOverrideSaved = (skillId: number, override: AssessorOverride) => {
    setOverrides((prev) => ({ ...prev, [skillId]: override }));
  };

  const handleQuoteClick = (turnNumber: number) => {
    if (session?.assessment_id) {
      navigate(`/assessments/${session.assessment_id}/sessions/${sessionId}/transcript#turn-${turnNumber}`);
    }
  };

  const comparisons: SkillComparison[] | null = match
    ? match.skills.map((s: any) => ({
        skill_label: s.skill_label,
        required_level: s.expected_level,
        expected_level: s.expected_level,
        candidate_level: s.candidate_level ?? undefined,
        ai_level: s.ai_level,
        override_level: s.override_level,
        is_override: s.is_override,
        result: s.result,
        delta: s.delta ?? undefined,
      }))
    : null;

  const configuredSkills = assessment?.skills ?? [];
  const hasConfiguredSkills = configuredSkills.length > 0;
  const completedSkills = portfolio?.skills ?? [];
  const discoveredSkills = completedSkills.filter((s) => s.is_discovered);
  const assessedSkills = completedSkills.filter((s) => !s.is_discovered);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link to="/candidates" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">
              {session?.candidate_name ?? `Candidate #${sessionId}`}
            </h1>
            <p className="text-sm text-muted-foreground">{session?.assessment?.name}</p>
          </div>
        </div>
        <StatusBadge status={session?.status} endReason={session?.end_reason} />
      </div>

      {/* Session metadata — interview context the AI result depends on */}
      {session && (
        <div className="border rounded-lg px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {session.duration_seconds != null && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {Math.round(session.duration_seconds / 60)} min interview
            </span>
          )}
          {session.ended_at && <span>Ended {new Date(session.ended_at).toLocaleString()}</span>}
          {session.end_reason && <span>End reason: {session.end_reason}</span>}
          {session.started_at && !session.ended_at && (
            <span>Started {new Date(session.started_at).toLocaleString()}</span>
          )}
          <Link
            to={`/assessments/${session.assessment_id}/sessions/${session.id}/transcript`}
            className="inline-flex items-center gap-1 text-primary hover:underline ml-auto"
          >
            <FileText className="h-3 w-3" />
            Read the full transcript
          </Link>
        </div>
      )}

      {/* Assessment context — what was supposed to be assessed */}
      {hasConfiguredSkills && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Assessed against</h2>
          <div className="flex flex-wrap gap-1.5">
            {configuredSkills.map((s) => (
              <span key={s.id ?? s.skill_label} className="border rounded-full px-2.5 py-0.5 text-xs">
                {s.skill_label}
                <span className="text-muted-foreground ml-1">L{s.expected_level ?? 3}</span>
                {s.is_custom && <span className="text-primary ml-1">custom</span>}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Portfolio with evidence — why the AI rated what it rated */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Portfolio results & evidence</h2>
        {portfolioStatus === "loading" ? (
          <Skeleton className="h-32 w-full" />
        ) : portfolioStatus === "generating" || portfolioStatus === "pending" ? (
          <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Portfolio is being generated...
          </div>
        ) : portfolioStatus === "failed" ? (
          <div className="border border-destructive/40 rounded-lg p-8 text-center text-sm text-destructive">
            Portfolio generation failed — retry from the assessment flow.
          </div>
        ) : portfolio && completedSkills.length > 0 ? (
          <div className="space-y-3">
            {assessedSkills.map((skill) => (
              <SkillPortfolioCard
                key={skill.id}
                skill={skill}
                override={overrides[skill.id]}
                onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                onQuoteClick={handleQuoteClick}
              />
            ))}

            {discoveredSkills.length > 0 && (
              <>
                <Separator />
                <p className="text-xs font-medium text-muted-foreground">
                  Discovered skills (not in the original assessment)
                </p>
                {discoveredSkills.map((skill) => (
                  <SkillPortfolioCard
                    key={skill.id}
                    skill={skill}
                    override={overrides[skill.id]}
                    onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                    onQuoteClick={handleQuoteClick}
                  />
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
            No portfolio yet — the candidate has not completed an interview.
          </div>
        )}
      </section>

      {/* Fit/Gap vs vacancy */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Fit/Gap vs vacancy</h2>
        </div>
        <Select value={selectedVacancy} onValueChange={(v) => { setSelectedVacancy(v); loadMatch(v); }}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Choose a vacancy..." /></SelectTrigger>
          <SelectContent>
            {vacancies.map((v) => (
              <SelectItem key={v.id} value={String(v.id)}>{v.role_title}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {matchLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : comparisons ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm">
                Match score:{" "}
                <span className={`font-semibold ${match!.score >= 80 ? "text-green-600" : match!.score >= 60 ? "text-amber-600" : "text-destructive"}`}>
                  {match!.score}%
                </span>
              </p>
              {session?.assessment_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/assessments/${session.assessment_id}/sessions/${sessionId}/fitgap/${selectedVacancy}`)}
                >
                  View Full Fit/Gap Report →
                </Button>
              )}
            </div>
            <ComparisonTable comparisons={comparisons} />
          </div>
        ) : selectedVacancy ? (
          <p className="text-sm text-muted-foreground">
            No match data for this candidate — their portfolio may not be complete.
          </p>
        ) : null}
      </section>
    </div>
  );
}
