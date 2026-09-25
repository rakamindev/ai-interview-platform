import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { assessmentsApi } from "@/services/assessments";
import { usePolling } from "@/hooks/usePolling";
import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  Zap,
  FileText,
  Briefcase,
  CheckCircle2,
  ArrowRight,
  User,
  Pencil,
  SlidersHorizontal,
} from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy, Assessment } from "@/types";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [showAlternativeVacancies, setShowAlternativeVacancies] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  const fetchPortfolio = useCallback(async () => {
    const res = await sessionsApi.getPortfolio(Number(sessionId));
    const data = res.data as any;
    if (
      data.status === "generating" ||
      data.portfolio?.generation_status === "generating" ||
      data.portfolio?.generation_status === "pending"
    ) {
      setGenerating(true);
    } else if (data.portfolio) {
      setPortfolio(data.portfolio);
      setGenerating(false);
      if (data.portfolio.candidate_name && !candidateName) {
        setCandidateName(data.portfolio.candidate_name);
      }
      // Build overrides map
      const overrideMap: Record<number, AssessorOverride> = {};
      data.portfolio.overrides.forEach((o: AssessorOverride) => {
        overrideMap[o.portfolio_skill_id] = o;
      });
      setOverrides(overrideMap);
    }
  }, [sessionId, candidateName]);

  useEffect(() => {
    Promise.all([
      fetchPortfolio(),
      vacanciesApi.list(),
      sessionsApi.get(Number(sessionId)),
      assessmentsApi.get(Number(id)),
    ])
      .then(([, vRes, sRes, aRes]) => {
        const vList = vRes.data.vacancies || [];
        setVacancies(vList);
        const cand = sRes.data.session.candidate_name || null;
        setCandidateName(cand);

        const ass = aRes.data.assessment;
        if (ass) {
          setAssessment(ass);
          if (ass.vacancy_id) {
            setSelectedVacancy(String(ass.vacancy_id));
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load portfolio context", err);
      })
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId, id]);

  // Poll while generating
  usePolling(fetchPortfolio, 5000, generating);

  const handleOverrideSaved = (skillId: number, override: AssessorOverride) => {
    setOverrides((prev) => ({ ...prev, [skillId]: override }));
  };

  const handleRunFitGap = (vacancyIdToUse?: string) => {
    const targetVacancyId = vacancyIdToUse || selectedVacancy;
    if (!targetVacancyId || !portfolio) return;
    navigate(`/assessments/${id}/sessions/${sessionId}/fitgap/${targetVacancyId}`);
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setSavingName(true);
    try {
      await sessionsApi.update(Number(sessionId), { candidate_name: nameInput.trim() });
      setCandidateName(nameInput.trim());
      setEditingName(false);
    } catch (err) {
      console.error("Failed to update candidate name", err);
    } finally {
      setSavingName(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        selectedVacancy ? Number(selectedVacancy) : undefined
      );
      const slug = candidateName
        ? candidateName.toLowerCase().replace(/[^a-z0-9]/g, "-")
        : `session-${sessionId}`;

      if (format === "json") {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-${slug}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-${slug}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 pb-12">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const linkedVacancy =
    (assessment?.vacancy_id && vacancies.find((v) => v.id === assessment.vacancy_id)) ||
    (assessment?.vacancy ? { id: assessment.vacancy.id, role_title: assessment.vacancy.role_title } : null);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to={`/assessments/${id}/invite`}
            className="p-1.5 rounded-lg border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {candidateName ? `${candidateName}'s Portfolio` : "Candidate Portfolio"}
              </h1>
              {portfolio?.generation_status === "complete" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="h-3 w-3" /> Ready
                </span>
              )}
            </div>

            <div className="flex items-center flex-wrap gap-2 text-xs text-muted-foreground mt-1">
              <div className="inline-flex items-center gap-1.5 font-semibold text-foreground bg-muted/70 px-2 py-0.5 rounded-md border border-border/60">
                <User className="h-3.5 w-3.5 text-[#01959F]" />
                <span>{candidateName || "Candidate"}</span>
                <button
                  type="button"
                  onClick={() => {
                    setNameInput(candidateName || "");
                    setEditingName(true);
                  }}
                  className="text-muted-foreground/70 hover:text-foreground transition-colors ml-0.5 cursor-pointer"
                  title="Edit candidate name"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
              <span>·</span>
              <span>Session #{sessionId}</span>
              {assessment && (
                <>
                  <span>·</span>
                  <span className="truncate max-w-[200px]">{assessment.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center flex-wrap gap-2 self-start sm:self-auto">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="inline-flex items-center gap-1.5 text-xs font-medium border rounded-md px-3 py-1.5 hover:bg-accent transition-colors shadow-sm"
          >
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            Transcript
          </Link>

          {!generating && portfolio && (
            <div className="flex items-center flex-wrap gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 shadow-sm"
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
              >
                {exporting === "pdf" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                )}
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 shadow-sm"
                onClick={() => handleExport("json")}
                disabled={!!exporting}
              >
                {exporting === "json" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                )}
                JSON
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Candidate Name Dialog */}
      <Dialog open={editingName} onOpenChange={setEditingName}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Candidate Name</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update candidate name for Session #{sessionId}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="candidate-name" className="text-xs font-semibold">
              Full Name
            </Label>
            <Input
              id="candidate-name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. John Doe, Siti Nurhaliza"
              className="text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingName(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveName}
              disabled={savingName}
              className="bg-[#01959F] hover:bg-[#017a82] text-white"
            >
              {savingName && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save Name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generating state */}
      {generating && (
        <Card className="border-dashed p-10 text-center">
          <CardContent className="space-y-3 p-0">
            <div className="w-12 h-12 rounded-full bg-[#01959F]/10 flex items-center justify-center mx-auto text-[#01959F]">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-base text-foreground">
                Generating AI Portfolio {candidateName ? `for ${candidateName}` : ""}...
              </p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                The AI is synthesizing interview transcripts{candidateName ? ` for ${candidateName}` : ""}, extracting competency evidence, and computing anchor levels.
              </p>
              {candidateName && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/80 text-xs font-semibold text-foreground mt-2 border border-border/60 shadow-sm">
                  <User className="h-3.5 w-3.5 text-[#01959F]" />
                  <span>Candidate: <strong>{candidateName}</strong></span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Failed state */}
      {!generating && portfolio?.generation_status === "failed" && (
        <div className="border border-destructive/40 bg-destructive/10 rounded-xl p-6 text-center space-y-3">
          <p className="text-sm text-destructive font-medium">Portfolio generation failed.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await sessionsApi.regeneratePortfolio(Number(sessionId));
              setGenerating(true);
            }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry Portfolio Generation
          </Button>
        </div>
      )}

      {/* Ready state */}
      {!generating && portfolio?.generation_status === "complete" && (
        <>
          {/* Vacancy-Centric Fit/Gap Section */}
          <Card className="border-[#01959F]/30 dark:border-[#01959F]/40 bg-gradient-to-br from-[#01959F]/5 via-background to-background shadow-sm">
            <CardContent className="p-5 space-y-4">
              {linkedVacancy ? (
                // Pre-linked vacancy flow: 1-click action
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#01959F]/10 dark:bg-[#01959F]/20 text-[#01959F] dark:text-teal-300 border border-[#01959F]/20">
                          <Briefcase className="h-3 w-3" /> Linked Vacancy
                        </span>
                        <span className="text-xs text-muted-foreground">Target Role</span>
                      </div>
                      <h3 className="text-base font-bold text-foreground">
                        {linkedVacancy.role_title}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        This assessment was linked to this role. Run Fit/Gap matching to benchmark candidate skills against vacancy expectations.
                      </p>
                    </div>

                    <Button
                      onClick={() => handleRunFitGap(String(linkedVacancy.id))}
                      className="bg-[#01959F] hover:bg-[#007E86] text-white font-semibold shadow-md shadow-[#01959F]/20 px-5 py-2.5 rounded-lg transition-all shrink-0 hover:shadow-lg hover:shadow-[#01959F]/30 flex items-center"
                    >
                      <Zap className="h-4 w-4 mr-1.5 text-[#FBC037] fill-[#FBC037]" />
                      Run Fit/Gap Analysis →
                    </Button>
                  </div>

                  {/* Alternative Vacancy Option */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAlternativeVacancies(!showAlternativeVacancies)}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
                    >
                      <SlidersHorizontal className="h-3 w-3" />
                      {showAlternativeVacancies
                        ? "Hide alternative vacancies"
                        : "Compare with a different vacancy instead..."}
                    </button>

                    {showAlternativeVacancies && (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 mt-3 pt-3 border-t border-border/60">
                        <Select
                          value={selectedVacancy}
                          onValueChange={setSelectedVacancy}
                        >
                          <SelectTrigger className="w-full sm:w-64 bg-background">
                            <SelectValue placeholder="Choose alternative vacancy..." />
                          </SelectTrigger>
                          <SelectContent>
                            {vacancies.map((v) => (
                              <SelectItem key={v.id} value={String(v.id)}>
                                {v.role_title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRunFitGap()}
                          disabled={!selectedVacancy || selectedVacancy === String(linkedVacancy.id)}
                        >
                          Compare Alternate Vacancy →
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // Standalone assessment: recruiter chooses vacancy
                <div className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Briefcase className="h-4 w-4 text-[#01959F]" />
                      Fit/Gap Analysis with Vacancy
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Compare candidate competencies against an open vacancy to identify strengths and skill gaps.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                    <Select
                      value={selectedVacancy}
                      onValueChange={setSelectedVacancy}
                    >
                      <SelectTrigger className="w-full sm:w-64 bg-background">
                        <SelectValue placeholder="Choose target vacancy..." />
                      </SelectTrigger>
                      <SelectContent>
                        {vacancies.map((v) => (
                          <SelectItem key={v.id} value={String(v.id)}>
                            {v.role_title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => handleRunFitGap()}
                      disabled={!selectedVacancy}
                      className="bg-[#01959F] hover:bg-[#007E86] text-white font-semibold shadow-md shadow-[#01959F]/20 px-5 py-2.5 rounded-lg transition-all hover:shadow-lg hover:shadow-[#01959F]/30 disabled:opacity-50 disabled:shadow-none flex items-center"
                    >
                      <Zap className="h-4 w-4 mr-1.5 text-[#FBC037] fill-[#FBC037]" />
                      Run Fit/Gap Analysis →
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configured skills */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Configured Competencies
              </h2>
              <span className="text-xs text-muted-foreground font-medium">
                {portfolio.skills.filter((s) => !s.is_discovered).length} evaluated
              </span>
            </div>

            <div className="space-y-2.5">
              {portfolio.skills
                .filter((s) => !s.is_discovered)
                .map((skill) => (
                  <SkillPortfolioCard
                    key={skill.id}
                    skill={skill}
                    override={overrides[skill.id]}
                    onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                  />
                ))}
            </div>
          </div>

          {/* Discovered skills */}
          {portfolio.skills.some((s) => s.is_discovered) && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                      <Zap className="h-4 w-4 text-amber-500" />
                      Discovered Skills
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Skills organically uncovered by the AI during the interview that were not part of the initial assessment plan.
                    </p>
                  </div>
                  <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800">
                    {portfolio.skills.filter((s) => s.is_discovered).length} discovered
                  </span>
                </div>

                <div className="space-y-2.5">
                  {portfolio.skills
                    .filter((s) => s.is_discovered)
                    .map((skill) => (
                      <SkillPortfolioCard
                        key={skill.id}
                        skill={skill}
                        override={overrides[skill.id]}
                        onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                      />
                    ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
