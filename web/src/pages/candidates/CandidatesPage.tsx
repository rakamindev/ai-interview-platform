import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { vacanciesApi } from "@/services/vacancies";
import { candidatesApi, type CandidateSummary, type MatchEntry } from "@/services/candidates";
import { CheckCheckIcon, CheckCircleIcon, ChevronLeft, ChevronRight as ChevronNext, CircleXIcon, RadioIcon, Search, Trophy, UserRound } from "lucide-react";
import type { PaginationMeta, Vacancy } from "@/types";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "awaiting", label: "Awaiting" },
  { value: "live", label: "Live now" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
] as const;

function StatusBadge({ c }: { c: CandidateSummary }) {
  if (c.status === "active") return <div className="flex gap-1 justify-center items-center">
    <RadioIcon className="text-secondary" size={"14"} />
    <span className="text-xs text-primary">Live now</span>
  </div>
  if (c.status === "ended" && c.end_reason === "error")
    return <div className="flex gap-1 justify-center items-center">
      <CircleXIcon className="text-destructive" size={"14"} />
      <span className="text-xs text-destructive">Failed</span>
    </div>
  if (c.status === "ended") return <div className="flex gap-1 justify-center items-center">
    <CheckCircleIcon className="text-primary" size={"14"} />
    <span className="text-xs text-primary">
      Completed</span>
  </div>
  return <div className="flex gap-1 justify-center items-center">
    <div className="relative inline-flex">
      <div className="w-2 h-2 bg-secondary rounded-full"></div>
      <div className="w-2 h-2 bg-secondary rounded-full absolute top-0 left-0 animate-ping"></div>
      <div className="w-2 h-2 bg-secondary rounded-full absolute top-0 left-0 animate-pulse"></div>
    </div>
    <span className="text-xs text-secondary">Awaiting</span>
  </div>
}

function scoreColor(score: number) {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-amber-600";
  return "text-destructive";
}

export default function CandidatesPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);

  const [candidates, setCandidates] = useState<CandidateSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    vacanciesApi.list({ per_page: 100 }).then((res) => setVacancies(res.data.vacancies)).catch(() => { });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setQDebounced(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const fetchCandidates = useCallback(() => {
    setLoading(true);
    setError(false);
    candidatesApi
      .list({
        page,
        per_page: 12,
        q: qDebounced || undefined,
        status: status === "all" ? undefined : (status as "awaiting" | "live" | "completed" | "failed"),
      })
      .then((res) => {
        setCandidates(res.data.candidates);
        setMeta(res.data.meta);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [page, qDebounced, status]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Candidates</h1>
        <p className="text-sm text-muted-foreground">
          Browse candidates across assessments and rank them against your vacancies.
        </p>
      </div>

      {/* Match ranking */}
      <section className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Match ranking by vacancy</h2>
        </div>
        <Select value={selectedVacancy} onValueChange={(v) => { setSelectedVacancy(v); loadMatches(v); }}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Choose a vacancy..." /></SelectTrigger>
          <SelectContent>
            {vacancies.map((v) => (
              <SelectItem key={v.id} value={String(v.id)}>{v.role_title}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {matchesLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : selectedVacancy && matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed candidates to rank yet.</p>
        ) : matches.length > 0 ? (
          <div className="space-y-1.5">
            {matches.map((m, i) => (
              <button
                key={m.session_id}
                type="button"
                onClick={() => navigate(`/candidates/${m.session_id}`)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted transition-colors text-left"
              >
                <span className="w-6 text-center text-sm font-medium text-muted-foreground">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.candidate_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.assessment_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min(100, m.score)}%` }}
                    />
                  </div>
                  <span className={`text-sm font-semibold w-8 text-right ${scoreColor(m.score)}`}>
                    {m.score}%
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {/* All candidates */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">All candidates</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search candidates..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8 w-56"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error ? (
          <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive">
            Failed to load candidates.
          </div>
        ) : loading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : candidates.length === 0 ? (
          <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
            {q || status !== "all" ? "No candidates match your filters." : "No candidates yet — invite someone to an interview."}
          </div>
        ) : (
          <div className="border rounded-lg divide-y">
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(`/candidates/${c.id}`)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.candidate_name ?? `Candidate #${c.id}`}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.assessment_name}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge c={c} />
                </div>
              </button>
            ))}
          </div>
        )}

        {meta && meta.total_pages > 1 && (
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">
              Page {meta.current_page} of {meta.total_pages} · {meta.total_count} candidates
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= meta.total_pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronNext className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
