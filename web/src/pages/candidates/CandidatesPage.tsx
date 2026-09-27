import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  RefreshCw,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CandidateFilters, CandidateStatistics, CandidateRecord, CandidatesResponse, candidatesApi } from "@/services/candidates";

type InterviewFilter = NonNullable<CandidateFilters["interview_status"]>;
type HiringFilter = NonNullable<CandidateFilters["hiring_decision"]>;

const emptyStats: CandidateStatistics = {
  total: 0, pending: 0, active: 0, completed: 0,
  failed: 0, expired: 0, under_review: 0, accepted: 0, rejected: 0,
};

function isExpired(candidate: CandidateRecord): boolean {
  return candidate.status === "pending" && !!candidate.expires_at &&
    new Date(candidate.expires_at).getTime() <= Date.now();
}

function isCompleted(candidate: CandidateRecord): boolean {
  return candidate.status === "ended" && candidate.end_reason !== "error";
}

function InterviewBadge({ candidate }: { candidate: CandidateRecord }) {
  let label = "Completed";
  let style = "bg-sky-50 text-sky-700";
  if (isExpired(candidate)) {
    label = "Expired";
    style = "bg-red-50 text-red-700";
  } else if (candidate.status === "pending") {
    label = "Awaiting Candidate";
    style = "bg-amber-50 text-amber-700";
  } else if (candidate.status === "active") {
    label = "Live Interview";
    style = "bg-emerald-50 text-emerald-700";
  } else if (candidate.status === "failed" || candidate.end_reason === "error") {
    label = "Failed";
    style = "bg-red-50 text-red-700";
  }
  return <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${style}`}>{label}</span>;
}

function HiringBadge({ candidate }: { candidate: CandidateRecord }) {
  if (!isCompleted(candidate)) return <span className="text-xs text-slate-400">Not available</span>;
  const decision = candidate.hiring_decision ?? "under_review";
  const styles = {
    under_review: "bg-amber-50 text-amber-700",
    accepted: "bg-emerald-50 text-emerald-700",
    rejected: "bg-red-50 text-red-700",
  };
  const labels = { under_review: "Under Review", accepted: "Accepted", rejected: "Rejected" };
  return <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${styles[decision]}`}>{labels[decision]}</span>;
}

function wibDate(date: string | null): string {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(parsed) + " WIB";
}

function CandidateActions({ candidate }: { candidate: CandidateRecord }) {
  const navigate = useNavigate();
  const base = `/assessments/${candidate.assessment_id}`;
  if (candidate.status === "active") {
    return (
      <Button type="button" size="sm" className="rounded-lg" onClick={() =>
        navigate(`${base}/sessions/${candidate.id}/monitor`)}>
        Monitor <ArrowRight className="ml-1.5 h-4 w-4" />
      </Button>
    );
  }
  if (isCompleted(candidate)) {
    return (
      <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() =>
        navigate(`${base}/sessions/${candidate.id}/portfolio`)}>
        Results <ArrowRight className="ml-1.5 h-4 w-4" />
      </Button>
    );
  }
  return <Button type="button" variant="outline" size="sm" className="rounded-lg" asChild>
    <Link to={`${base}/invite`}>View Assessment <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
  </Button>;
}

function StatBox({ label, value, icon: Icon }: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return <div className="flex items-start justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
    </div>
    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <Icon className="h-5 w-5" />
    </div>
  </div>;
}

export default function CandidatesPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [assessmentId, setAssessmentId] = useState("");
  const [interviewStatus, setInterviewStatus] = useState<InterviewFilter>("all");
  const [hiringDecision, setHiringDecision] = useState<HiringFilter>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CandidatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const loadCandidates = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(false);
    try {
      const response = await candidatesApi.list({
        page,
        q: debouncedSearch || undefined,
        assessment_id: assessmentId ? Number(assessmentId) : undefined,
        interview_status: interviewStatus,
        hiring_decision: hiringDecision,
      });
      if (id === requestId.current) setData(response.data);
    } catch (cause) {
      console.error("Unable to load candidates:", cause);
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [page, debouncedSearch, assessmentId, interviewStatus, hiringDecision]);

  useEffect(() => {
    void loadCandidates();
    return () => { requestId.current += 1; };
  }, [loadCandidates]);

  const candidates = data?.candidates ?? [];
  const stats = data?.meta.statistics ?? emptyStats;
  const totalPages = data?.meta.total_pages ?? 1;
  const total = data?.meta.total_count ?? 0;
  const perPage = data?.meta.per_page ?? 10;
  const start = total === 0 ? 0 : (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);
  const filterChanged = () => setPage(1);

  return <div className="mx-auto max-w-7xl space-y-7 pb-10">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-primary">Candidate Management</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Candidates</h1>
        <p className="mt-2 text-sm text-slate-500">Monitor candidate interview sessions across all assessments.</p>
      </div>
      <Button type="button" variant="outline" className="rounded-xl" onClick={() => void loadCandidates()} disabled={loading}>
        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
      </Button>
    </header>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatBox label="Total Sessions" value={stats.total} icon={Users} />
      <StatBox label="Awaiting Candidate" value={stats.pending} icon={Clock3} />
      <StatBox label="Completed" value={stats.completed} icon={CheckCircle2} />
      <StatBox label="Under Review" value={stats.under_review} icon={ClipboardList} />
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="space-y-4 border-b border-slate-100 p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">All Candidates</h2>
          <p className="mt-1 text-xs text-slate-500">Each row represents one interview session. A candidate may appear more than once.</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={e => { setSearch(e.target.value); filterChanged(); }}
            placeholder="Search by candidate, email or assessment..." aria-label="Search candidates"
            className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-11 pr-10" />
          {search && <button type="button" aria-label="Clear search" onClick={() => { setSearch(""); filterChanged(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            <span>Assessment</span>
            <select aria-label="Filter by assessment" value={assessmentId}
              onChange={e => { setAssessmentId(e.target.value); filterChanged(); }}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800">
              <option value="">All Assessments</option>
              {(data?.assessments ?? []).map(assessment =>
                <option value={assessment.id} key={assessment.id}>{assessment.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            <span>Interview Status</span>
            <select aria-label="Filter by interview status" value={interviewStatus}
              onChange={e => { setInterviewStatus(e.target.value as InterviewFilter); filterChanged(); }}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800">
              <option value="all">All Statuses</option>
              <option value="pending">Awaiting Candidate</option>
              <option value="active">Live Interview</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="expired">Expired</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            <span>Hiring Status</span>
            <select aria-label="Filter by hiring status" value={hiringDecision}
              onChange={e => { setHiringDecision(e.target.value as HiringFilter); filterChanged(); }}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800">
              <option value="all">All Hiring Statuses</option>
              <option value="under_review">Under Review</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
        </div>
      </div>

      {error ? <div role="alert" className="flex flex-col items-center px-6 py-14 text-center">
        <AlertCircle className="h-9 w-9 text-red-500" />
        <p className="mt-4 font-semibold text-slate-900">Unable to load candidates</p>
        <p className="mt-2 text-sm text-slate-500">Please check your connection and try again.</p>
        <Button variant="outline" className="mt-5" onClick={() => void loadCandidates()}>Try Again</Button>
      </div> : loading ? <div className="space-y-3 p-6">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div> : candidates.length === 0 ? <div className="flex flex-col items-center px-6 py-16 text-center">
        <UserRound className="h-10 w-10 text-slate-300" />
        <p className="mt-4 font-semibold text-slate-900">No candidate sessions found</p>
        <p className="mt-2 text-sm text-slate-500">Try changing the filters or create an invitation from Assessments.</p>
        <Button className="mt-5" asChild><Link to="/assessments">Go to Assessments</Link></Button>
      </div> : <>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left">
            <thead className="border-b border-slate-100 bg-slate-50/80">
              <tr>{["Candidate", "Assessment", "Interview", "Hiring Status", "Created", "Action"].map(label =>
                <th key={label} className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.map(candidate => <tr key={candidate.id} className="hover:bg-slate-50/80">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {(candidate.candidate_name || "C").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="max-w-[190px] truncate text-sm font-semibold text-slate-800">{candidate.candidate_name || `Candidate ${candidate.id}`}</p>
                      <p className="max-w-[190px] truncate text-xs text-slate-400">{candidate.candidate_email || `${candidate.candidate_email ?? `-`}`}</p>
                    </div>
                  </div>
                </td>
                <td className="max-w-[200px] px-5 py-4 text-sm text-slate-600">
                  <Link to={`/assessments/${candidate.assessment_id}/invite`} className="hover:text-primary hover:underline">{candidate.assessment_name}</Link>
                </td>
                <td className="px-5 py-4"><InterviewBadge candidate={candidate} /></td>
                <td className="px-5 py-4"><HiringBadge candidate={candidate} /></td>
                <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">{wibDate(candidate.created_at)}</td>
                <td className="px-5 py-4"><CandidateActions candidate={candidate} /></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-slate-100 md:hidden">
          {candidates.map(candidate => <div key={candidate.id} className="space-y-3 p-5">
            <p className="font-semibold text-slate-900">{candidate.candidate_name || `Candidate ${candidate.id}`}</p>
            <p className="break-all text-xs text-slate-500">{candidate.candidate_email}</p>
            <p className="text-sm text-slate-600">{candidate.assessment_name}</p>
            <div className="flex flex-wrap gap-2"><InterviewBadge candidate={candidate}/><HiringBadge candidate={candidate}/></div>
            <p className="text-xs text-slate-400">Created: {wibDate(candidate.created_at)}</p>
            <CandidateActions candidate={candidate}/>
          </div>)}
        </div>
      </>}
      <div className="flex flex-col gap-4 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">Showing {start}–{end} of {total} sessions</p>
        {totalPages > 1 && <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={page <= 1 || loading}
            onClick={() => setPage(current => Math.max(1, current - 1))}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          <span className="px-2 text-sm text-slate-600">{page} / {totalPages}</span>
          <Button type="button" size="sm" variant="outline" disabled={page >= totalPages || loading}
            onClick={() => setPage(current => Math.min(totalPages, current + 1))}>
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>}
      </div>
    </section>
  </div>;
}
