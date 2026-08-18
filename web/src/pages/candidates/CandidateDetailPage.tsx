import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, FileText, Loader2, Trophy, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { assessmentsApi } from "@/services/assessments";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { candidatesApi, type MatchEntry } from "@/services/candidates";
import type { Assessment, AssessorOverride, Portfolio, SkillComparison, Vacancy } from "@/types";

function StatusBadge({ status, endReason }: { status?: string; endReason?: string | null }) {
  if (status === "active") return <span className="text-xs text-primary font-medium">Live now</span>;
  if (status === "ended" && endReason === "error")
    return <span className="text-xs text-destructive font-medium">Failed</span>;
  if (status === "ended") return <span className="text-xs text-muted-foreground font-medium">Completed</span>;
  return <span className="text-xs text-muted-foreground font-medium">Awaiting</span>;
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
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

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

  const handleExport = async (format: "pdf" | "json", vacancyId?: number) => {
    if (!portfolio) return;
    setExporting(format);
    setExportError(null);
    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        vacancyId
      );
      const nameSlug = session?.candidate_name
        ? `-${session.candidate_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
        : "";
      const prefix = vacancyId
        ? `fitgap${nameSlug}-session-${sessionId}-vacancy-${vacancyId}`
        : `portfolio${nameSlug}-session-${sessionId}`;

      if (format === "json") {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${prefix}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${prefix}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      setExportError("Export failed. Please try again.");
    } finally {
      setExporting(null);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/candidates")}
            className="h-8 w-8 shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">
                {session?.candidate_name ?? `Candidate #${sessionId}`}
              </h1>
              <StatusBadge status={session?.status} endReason={session?.end_reason} />
            </div>
            <p className="text-sm text-muted-foreground">{session?.assessment?.name}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
          {session?.assessment_id && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1.5"
              onClick={() => navigate(`/assessments/${session.assessment_id}/sessions/${session.id}/transcript`)}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Transcript</span>
            </Button>
          )}

          {portfolio && portfolioStatus === "complete" && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 gap-1.5"
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
              >
                {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                <span>Export PDF</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 gap-1.5"
                onClick={() => handleExport("json")}
                disabled={!!exporting}
              >
                {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                <span>Export JSON</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {exportError && (
        <div className="border border-destructive/40 bg-destructive/5 rounded-lg p-3 text-xs text-destructive">
          {exportError}
        </div>
      )}

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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 p-3 rounded-lg border">
              <p className="text-sm">
                Match score:{" "}
                <span className={`font-semibold ${match!.score >= 80 ? "text-primary" : match!.score >= 60 ? "text-secondary-foreground" : "text-destructive"}`}>
                  {match!.score}%
                </span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => handleExport("pdf", Number(selectedVacancy))}
                  disabled={!!exporting}
                >
                  <Download className="h-3 w-3" />
                  <span>Export Fit/Gap PDF</span>
                </Button>
                {session?.assessment_id && (
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={() => navigate(`/assessments/${session.assessment_id}/sessions/${sessionId}/fitgap/${selectedVacancy}`)}
                  >
                    <span>Full Report</span>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
              </div>
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
