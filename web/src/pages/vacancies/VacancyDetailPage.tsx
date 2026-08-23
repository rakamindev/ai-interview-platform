import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { vacanciesApi } from "@/services/vacancies";
import { LEVEL_LABELS } from "@/utils/constants";
import CreateAssessmentFromVacancyDialog from "@/components/vacancies/CreateAssessmentFromVacancyDialog";
import BulkAssignDialog from "@/components/vacancies/BulkAssignDialog";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Briefcase,
  Users,
  ClipboardList,
  Eye,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
import type { Vacancy, VacancyCandidate, VacancyAssessmentSummary, Assessment } from "@/types";

// ─── Fit score badge ─────────────────────────────────────────────────────────
function FitBadge({ score, label }: { score?: number | null; label?: string | null }) {
  if (score == null) return <span className="text-xs text-muted-foreground">Pending</span>;

  const color =
    score >= 80 ? "bg-green-100 text-green-700 border-green-200" :
    score >= 60 ? "bg-blue-100 text-blue-700 border-blue-200" :
    score >= 40 ? "bg-amber-100 text-amber-700 border-amber-200" :
                  "bg-red-100 text-red-700 border-red-200";

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${color}`}>
      {score}% · {label}
    </span>
  );
}

// ─── Status dot ──────────────────────────────────────────────────────────────
function StatusDot({ status }: { status: VacancyCandidate["status"] }) {
  if (status === "active") return <span className="flex items-center gap-1 text-xs text-primary"><span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />Live</span>;
  if (status === "pending") return <span className="flex items-center gap-1 text-xs text-amber-600"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Awaiting</span>;
  return <span className="flex items-center gap-1 text-xs text-green-600"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Done</span>;
}

// ─── Candidate row ───────────────────────────────────────────────────────────
function CandidateRow({
  candidate,
  assessmentName,
  vacancyId,
  selected,
  onToggle,
}: {
  candidate: VacancyCandidate;
  assessmentName: string;
  vacancyId: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-3 py-3 px-4">
      <Checkbox
        checked={selected}
        onCheckedChange={onToggle}
        id={`cand-${candidate.session_id}`}
        aria-label={`Select ${candidate.candidate_name ?? "candidate"}`}
      />
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{candidate.candidate_name ?? `Session #${candidate.session_id}`}</span>
          <StatusDot status={candidate.status} />
        </div>
        <p className="text-xs text-muted-foreground truncate">{assessmentName}</p>
        {candidate.matched_skills.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {candidate.matched_skills.slice(0, 3).map((s) => (
              <span key={s} className="inline-flex items-center gap-0.5 text-[10px] bg-green-50 text-green-700 border border-green-200 rounded px-1.5 py-0">
                <CheckCircle2 className="h-2.5 w-2.5" />{s}
              </span>
            ))}
            {candidate.gap_skills.slice(0, 2).map((s) => (
              <span key={s} className="inline-flex items-center gap-0.5 text-[10px] bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0">
                <XCircle className="h-2.5 w-2.5" />{s}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <FitBadge score={candidate.fit_score} label={candidate.fit_label} />
        {candidate.profile_ready && candidate.portfolio_id && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => navigate(`/assessments/${candidate.assessment_id}/sessions/${candidate.session_id}/portfolio`)}
          >
            <Eye className="h-3 w-3 mr-1" />Profile
          </Button>
        )}
        {candidate.status === "active" && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => navigate(`/assessments/${candidate.assessment_id}/sessions/${candidate.session_id}/monitor`)}
          >
            <Eye className="h-3 w-3 mr-1" />Monitor
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function VacancyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [candidates, setCandidates] = useState<VacancyCandidate[]>([]);
  const [assessments, setAssessments] = useState<VacancyAssessmentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [createAssessOpen, setCreateAssessOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);

  const loadCandidates = useCallback(async () => {
    if (!id) return;
    const res = await vacanciesApi.listCandidates(Number(id));
    setCandidates(res.data.candidates);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      vacanciesApi.get(Number(id)),
      vacanciesApi.listCandidates(Number(id)),
      vacanciesApi.listAssessments(Number(id)),
    ]).then(([vRes, cRes, aRes]) => {
      setVacancy(vRes.data.vacancy);
      setCandidates(cRes.data.candidates);
      setAssessments(aRes.data.assessments);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  // Poll when any session is live
  useEffect(() => {
    const hasLive = candidates.some((c) => c.status !== "ended");
    if (!hasLive) return;
    const iv = setInterval(loadCandidates, 6000);
    return () => clearInterval(iv);
  }, [candidates, loadCandidates]);

  const toggleSelect = (sessionId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(sessionId) ? next.delete(sessionId) : next.add(sessionId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) =>
      prev.size === candidates.length ? new Set() : new Set(candidates.map((c) => c.session_id))
    );
  };

  const handleAssessmentCreated = (assessment: Assessment) => {
    setAssessments((prev) => [
      { id: assessment.id, name: assessment.name, time_limit_min: assessment.time_limit_min, language: assessment.language ?? "en", created_at: assessment.created_at ?? "", session_count: 0 },
      ...prev,
    ]);
  };

  const assessmentNameMap = Object.fromEntries(assessments.map((a) => [a.id, a.name]));

  // Sort candidates: ended with fit score first, then by score desc
  const sortedCandidates = [...candidates].sort((a, b) => {
    if (a.fit_score != null && b.fit_score != null) return b.fit_score - a.fit_score;
    if (a.fit_score != null) return -1;
    if (b.fit_score != null) return 1;
    return 0;
  });

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!vacancy) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16 text-muted-foreground">
        Vacancy not found.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/vacancies" className="text-muted-foreground hover:text-foreground shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                <h1 className="text-lg font-semibold truncate">{vacancy.role_title}</h1>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                {vacancy.skills?.length ?? 0} required skills · {candidates.length} candidates · {assessments.length} assessments
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(`/vacancies/${id}/edit`)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="candidates">
          <TabsList>
            <TabsTrigger value="candidates">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Candidates {candidates.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 text-[10px]">{candidates.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="assessments">
              <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
              Assessments {assessments.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 text-[10px]">{assessments.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="overview">
              <Briefcase className="h-3.5 w-3.5 mr-1.5" />
              Overview
            </TabsTrigger>
          </TabsList>

          {/* ── Candidates tab ─────────────────────────────────────────────── */}
          <TabsContent value="candidates" className="mt-4 space-y-3">
            {candidates.length > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedIds.size === candidates.length && candidates.length > 0}
                    onCheckedChange={toggleAll}
                    id="select-all"
                    aria-label="Select all candidates"
                  />
                  <label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer">
                    {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
                  </label>
                </div>
                {selectedIds.size > 0 && (
                  <Button size="sm" onClick={() => setBulkAssignOpen(true)}>
                    <Users className="h-3.5 w-3.5 mr-1.5" />
                    Assign to Assessment ({selectedIds.size})
                  </Button>
                )}
              </div>
            )}

            {candidates.length === 0 ? (
              <div className="border rounded-lg p-12 text-center space-y-3">
                <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto" />
                <div>
                  <p className="text-sm font-medium">No candidates yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create an assessment and invite candidates to see AI-ranked profiles here.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setCreateAssessOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Create Assessment
                </Button>
              </div>
            ) : (
              <Card>
                <CardContent className="p-0 divide-y">
                  {sortedCandidates.map((c) => (
                    <CandidateRow
                      key={c.session_id}
                      candidate={c}
                      assessmentName={assessmentNameMap[c.assessment_id] ?? "—"}
                      vacancyId={id!}
                      selected={selectedIds.has(c.session_id)}
                      onToggle={() => toggleSelect(c.session_id)}
                    />
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Assessments tab ────────────────────────────────────────────── */}
          <TabsContent value="assessments" className="mt-4 space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setCreateAssessOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />Create Assessment
              </Button>
            </div>

            {assessments.length === 0 ? (
              <div className="border rounded-lg p-12 text-center space-y-3">
                <ClipboardList className="h-8 w-8 text-muted-foreground mx-auto" />
                <div>
                  <p className="text-sm font-medium">No assessments yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create one — skills will be pre-filled from this vacancy.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {assessments.map((a) => (
                  <Card key={a.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => navigate(`/assessments/${a.id}/invite`)}>
                    <CardContent className="py-3 px-4 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{a.name}</p>
                        <p className="text-xs text-muted-foreground">
                          <Clock className="inline h-3 w-3 mr-0.5" />{a.time_limit_min} min · {a.session_count} sessions
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">{a.language === "id" ? "Indonesian" : "English"}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Overview tab ───────────────────────────────────────────────── */}
          <TabsContent value="overview" className="mt-4 space-y-5">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Required Skills</h2>
              {(vacancy.skills?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No skills defined.</p>
              ) : (
                <div className="space-y-1">
                  {vacancy.skills!.map((s) => (
                    <div key={s.id ?? s.skill_label} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <span className="text-sm">{s.skill_label}</span>
                      <span className="text-xs text-muted-foreground">Expected {LEVEL_LABELS[s.expected_level]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {vacancy.culture_dimensions && (
              <div className="space-y-1.5">
                <h2 className="text-sm font-semibold">Company Culture</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{vacancy.culture_dimensions}</p>
              </div>
            )}

            {vacancy.competency_expectations && (
              <div className="space-y-1.5">
                <h2 className="text-sm font-semibold">Competency Expectations</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{vacancy.competency_expectations}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        {vacancy && (
          <CreateAssessmentFromVacancyDialog
            open={createAssessOpen}
            onOpenChange={setCreateAssessOpen}
            vacancy={vacancy}
            onCreated={handleAssessmentCreated}
          />
        )}

        <BulkAssignDialog
          open={bulkAssignOpen}
          onOpenChange={setBulkAssignOpen}
          candidates={candidates}
          assessments={assessments}
          selectedIds={selectedIds}
        />
      </div>
    </TooltipProvider>
  );
}
