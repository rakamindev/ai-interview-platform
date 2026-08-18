import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { vacanciesApi } from "@/services/vacancies";
import { assessmentsApi } from "@/services/assessments";
import { candidatesApi, type CandidateSummary, type MatchEntry } from "@/services/candidates";
import {
  Search,
  Trophy,
  Users,
  CheckCircle2,
  Clock,
  CircleX,
  FileText,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Filter,
  ExternalLink,
  Briefcase,
  Check,
  TrendingUp,
  AlertTriangle
} from "lucide-react";
import type { Assessment, PaginationMeta, Vacancy } from "@/types";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "completed", label: "Completed" },
  { value: "live", label: "Live Now" },
  { value: "awaiting", label: "Awaiting" },
  { value: "failed", label: "Failed" },
] as const;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name", label: "Name (A-Z)" },
] as const;

function StatusBadge({ c }: { c: CandidateSummary }) {
  if (c.status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
        </span>
        Live now
      </span>
    );
  }
  if (c.status === "ended" && c.end_reason === "error") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
        <CircleX className="h-3 w-3" />
        Failed
      </span>
    );
  }
  if (c.status === "ended") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
        <CheckCircle2 className="h-3 w-3" />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary/20 text-secondary-foreground border border-secondary/40">
      <Clock className="h-3 w-3" />
      Awaiting
    </span>
  );
}

function scoreBadgeClass(score: number) {
  if (score >= 80) return "bg-primary/10 text-primary border-primary/20";
  if (score >= 60) return "bg-secondary/20 text-secondary-foreground border-secondary/40";
  return "bg-destructive/10 text-destructive border-destructive/20";
}

function scoreColor(score: number) {
  if (score >= 80) return "text-primary";
  if (score >= 60) return "text-secondary-foreground";
  return "text-destructive";
}

export default function CandidatesPage() {
  const navigate = useNavigate();

  // Tab State: "all" or "ranking"
  const [activeTab, setActiveTab] = useState<"all" | "ranking">("all");

  // Assessments & Vacancies Filter options
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>("all");
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);

  // Candidate Directory List state
  const [candidates, setCandidates] = useState<CandidateSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");
  const [page, setPage] = useState(1);

  // Load filter options
  useEffect(() => {
    assessmentsApi.list({ per_page: 100 }).then((res) => setAssessments(res.data.assessments)).catch(() => {});
    vacanciesApi.list({ per_page: 100 }).then((res) => setVacancies(res.data.vacancies)).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setQDebounced(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const fetchCandidates = useCallback(() => {
    setLoading(true);
    setError(false);
    candidatesApi
      .list({
        page,
        per_page: 10,
        q: qDebounced || undefined,
        assessment_id: selectedAssessmentId === "all" ? undefined : Number(selectedAssessmentId),
        status: status === "all" ? undefined : (status as "awaiting" | "live" | "completed" | "failed"),
        sort,
      })
      .then((res) => {
        setCandidates(res.data.candidates);
        setMeta(res.data.meta);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [page, qDebounced, selectedAssessmentId, status, sort]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const loadMatches = (vacancyId: string) => {
    if (!vacancyId) {
      setMatches([]);
      return;
    }
    setMatchesLoading(true);
    candidatesApi
      .matches(Number(vacancyId))
      .then((res) => setMatches(res.data.matches))
      .catch(() => setMatches([]))
      .finally(() => setMatchesLoading(false));
  };

  const selectedVacancyData = vacancies.find((v) => String(v.id) === selectedVacancy);

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Browse candidates across assessments and rank them against role vacancies.
          </p>
        </div>

        {/* Tab Switcher */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            const nextTab = v as "all" | "ranking";
            setActiveTab(nextTab);
            if (nextTab === "ranking" && !selectedVacancy && vacancies.length > 0) {
              const firstId = String(vacancies[0].id);
              setSelectedVacancy(firstId);
              loadMatches(firstId);
            }
          }}
        >
          <TabsList className="h-9">
            <TabsTrigger value="all" className="gap-1.5 px-4 text-xs font-medium">
              <Users className="h-3.5 w-3.5" />
              All
            </TabsTrigger>
            <TabsTrigger value="ranking" className="gap-1.5 px-4 text-xs font-medium">
              <Trophy className="h-3.5 w-3.5" />
              Ranking
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* TAB 1: ALL CANDIDATES */}
      {activeTab === "all" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search candidates..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-8 h-9"
              />
            </div>

            {/* Assessment Filter */}
            <div className="w-full sm:w-52">
              <Select
                value={selectedAssessmentId}
                onValueChange={(val) => {
                  setSelectedAssessmentId(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9">
                  <div className="flex items-center gap-1.5 truncate">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="All Assessments" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assessments ({assessments.length})</SelectItem>
                  {assessments.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-36">
              <Select
                value={status}
                onValueChange={(val) => {
                  setStatus(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort Filter */}
            <div className="w-full sm:w-32">
              <Select
                value={sort}
                onValueChange={(val) => {
                  setSort(val as "newest" | "oldest" | "name");
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9">
                  <div className="flex items-center gap-1.5">
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Candidates Table */}
          {error ? (
            <div className="border border-destructive/40 bg-destructive/5 rounded-xl p-6 text-center text-sm text-destructive">
              Failed to load candidates. Please refresh the page.
            </div>
          ) : loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : candidates.length === 0 ? (
            <div className="border border-dashed rounded-xl p-12 text-center bg-muted/20">
              <Users className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm font-semibold">No candidates found</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                {q || status !== "all" || selectedAssessmentId !== "all"
                  ? "Try changing your search query or filter options."
                  : "No candidates yet. Invite candidates from an assessment."}
              </p>
            </div>
          ) : (
            <div className="border rounded-xl bg-card shadow overflow-hidden">
              {/* Structured Table Header */}
              <div className="grid grid-cols-12 px-4 py-2.5 bg-muted/50 border-b text-xs font-medium text-muted-foreground items-center">
                <div className="col-span-5 sm:col-span-4">Candidate</div>
                <div className="col-span-3 hidden sm:block">Assessment</div>
                <div className="col-span-3 sm:col-span-2 text-center">Interview</div>
                <div className="col-span-2 hidden sm:block text-center">Portfolio</div>
                <div className="col-span-4 sm:col-span-1 text-right">Actions</div>
              </div>

              {/* Table Rows */}
              <div className="divide-y">
                {candidates.map((c) => (
                  <div
                    key={c.id}
                    className="grid grid-cols-12 px-4 py-3 items-center hover:bg-muted/30 transition-colors text-sm"
                  >
                    {/* Col 1: Candidate info */}
                    <div className="col-span-5 sm:col-span-4 flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center shrink-0">
                        {(c.candidate_name || `K${c.id}`).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => navigate(`/candidates/${c.id}`)}
                          className="font-medium text-foreground hover:text-primary transition-colors truncate block text-left text-sm"
                        >
                          {c.candidate_name ?? `Candidate #${c.id}`}
                        </button>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>#{c.id}</span>
                          {c.created_at && (
                            <>
                              <span>·</span>
                              <span>{new Date(c.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Col 2: Assessment role */}
                    <div className="col-span-3 hidden sm:block text-xs text-muted-foreground truncate pr-2">
                      <span className="font-medium text-foreground/80">{c.assessment_name}</span>
                    </div>

                    {/* Col 3: Interview Status */}
                    <div className="col-span-3 sm:col-span-2 flex justify-center">
                      <StatusBadge c={c} />
                    </div>

                    {/* Col 4: Portfolio Status */}
                    <div className="col-span-2 hidden sm:flex justify-center items-center">
                      {c.portfolio_status === "complete" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                          <Sparkles className="h-3 w-3" />
                          Ready
                        </span>
                      ) : c.portfolio_status === "generating" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                          <span className="animate-spin text-xs">⏳</span>
                          Generating...
                        </span>
                      ) : c.portfolio_status === "failed" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                          Failed
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>

                    {/* Col 5: Actions */}
                    <div className="col-span-4 sm:col-span-1 flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1 px-2.5"
                        onClick={() => navigate(`/candidates/${c.id}`)}
                      >
                        <span>Detail</span>
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pagination */}
          {meta && meta.total_pages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                Page {meta.current_page} of {meta.total_pages} · {meta.total_count} candidates
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-8 text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= meta.total_pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 text-xs"
                >
                  Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: VACANCY MATCH RANKING */}
      {activeTab === "ranking" && (
        <div className="space-y-4">
          {/* Vacancy Selector */}
          <div className="bg-card border rounded-xl p-4 shadow space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Select Vacancy</span>
              </div>

              <Select
                value={selectedVacancy}
                onValueChange={(v) => {
                  setSelectedVacancy(v);
                  loadMatches(v);
                }}
              >
                <SelectTrigger className="w-full sm:w-72 h-9 font-medium text-sm">
                  <SelectValue placeholder="Choose a vacancy..." />
                </SelectTrigger>
                <SelectContent>
                  {vacancies.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.role_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Vacancy skills overview */}
            {selectedVacancyData && selectedVacancyData.skills?.length > 0 && (
              <div className="pt-2 border-t flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground font-medium">Required skills:</span>
                {selectedVacancyData.skills.map((s) => (
                  <span
                    key={s.id ?? s.skill_label}
                    className="bg-muted px-2 py-0.5 rounded text-foreground font-medium border"
                  >
                    {s.skill_label} <span className="text-primary font-semibold">L{s.expected_level}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Ranking Results */}
          {matchesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : !selectedVacancy ? (
            <div className="border border-dashed rounded-xl p-12 text-center bg-muted/20">
              <Briefcase className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm font-semibold">Choose a Vacancy</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                Select a vacancy above to view ranked candidates and skill match comparisons.
              </p>
            </div>
          ) : matches.length === 0 ? (
            <div className="border border-dashed rounded-xl p-12 text-center bg-muted/20">
              <Users className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm font-semibold">No Completed Candidates Yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                Candidates with completed portfolios will automatically be ranked against this vacancy.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {matches.map((m, i) => {
                const matchCount = m.skills.filter((s) => s.result === "match").length;
                const exceedCount = m.skills.filter((s) => s.result === "exceed").length;
                const gapCount = m.skills.filter((s) => s.result === "gap").length;

                return (
                  <div
                    key={m.session_id}
                    className="bg-card border rounded-xl p-4 shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-primary/40 transition-colors"
                  >
                    {/* Rank & Candidate Info */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-muted border flex items-center justify-center font-semibold text-xs text-muted-foreground shrink-0">
                        #{i + 1}
                      </div>

                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => navigate(`/candidates/${m.session_id}`)}
                          className="font-semibold text-foreground hover:text-primary transition-colors truncate block text-left text-sm"
                        >
                          {m.candidate_name}
                        </button>
                        <p className="text-xs text-muted-foreground truncate">{m.assessment_name}</p>

                        {/* Skill summary breakdown chips */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {matchCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-primary/10 text-primary border border-primary/20 font-medium">
                              <Check className="h-3 w-3" /> {matchCount} Match
                            </span>
                          )}
                          {exceedCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-primary/20 text-primary border border-primary/30 font-medium">
                              <TrendingUp className="h-3 w-3" /> {exceedCount} Exceed
                            </span>
                          )}
                          {gapCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-destructive/10 text-destructive border border-destructive/20 font-medium">
                              <AlertTriangle className="h-3 w-3" /> {gapCount} Gap
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Score Bar & Actions */}
                    <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <span className={`text-lg font-semibold ${scoreColor(m.score)}`}>
                            {m.score}%
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${scoreBadgeClass(
                              m.score
                            )}`}
                          >
                            {m.score >= 80 ? "Strong Match" : m.score >= 60 ? "Moderate" : "Low Match"}
                          </span>
                        </div>
                        <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                          <div
                            className={`h-full rounded-full ${
                              m.score >= 80 ? "bg-primary" : m.score >= 60 ? "bg-secondary" : "bg-destructive"
                            }`}
                            style={{ width: `${Math.min(100, m.score)}%` }}
                          />
                        </div>
                      </div>

                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1 px-3"
                        onClick={() => navigate(`/candidates/${m.session_id}`)}
                      >
                        <span>Fit/Gap</span>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
