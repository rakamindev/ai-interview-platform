import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  CalendarClock,
  ClipboardCheck,
  Mail,
  Copy,
  Eye,
  Layers3,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { assessmentsApi, CandidateSessionsMeta } from "@/services/assessments";
import { sessionsApi } from "@/services/sessions";
import { LEVEL_LABELS } from "@/utils/constants";
import type {
  Assessment,
  PaginationMeta,
  Session,
} from "@/types";
import CandidateSessionStatistics from "@/components/assessment/CandidateSessionStatistics";
import { customExpirationIso, formatExpiryWib, formatSessionDate, isExpired, todayWib } from "@/utils/general";
type ExpirationChoice = 1 | 3 | 7 | "custom";


const initialMeta: CandidateSessionsMeta = {
  current_page: 1,
  total_pages: 1,
  total_count: 0,
  per_page: 10,
};
function getErrorMessage(error: unknown, fallback: string) {
  const response = (
    error as {
      response?: {
        data?: {
          error?: string;
          message?: string;
        };
      };
    }
  )?.response;
  return response?.data?.error ?? response?.data?.message ?? fallback;
}
function SessionStatus({ session }: { session: Session }) {
  if (isExpired(session)) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        Expired
      </span>
    );
  }
  if (session.status === "pending") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        Awaiting Candidate
      </span>
    );
  }
  if (session.status === "active") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        Live Interview
      </span>
    );
  }
  if (session.status === "failed" || session.end_reason === "error") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">
      <span className="h-2 w-2 rounded-full bg-sky-500" />
      Completed
    </span>
  );
}
function HiringDecisionBadge({ session }: { session: Session }) {
  const completed =
    session.status === "ended" && session.end_reason !== "error";

  if (!completed) {
    return <span className="text-xs text-slate-400">Not available</span>;
  }

  const decision = session.hiring_decision ?? "under_review";

  if (decision === "accepted") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
        <Check className="h-3.5 w-3.5" /> Accepted
      </span>
    );
  }

  if (decision === "rejected") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
        <X className="h-3.5 w-3.5" /> Rejected
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
      <ClipboardCheck className="h-3.5 w-3.5" /> Under Review
    </span>
  );
}

interface SessionActionsProps {
  session: Session;
  assessmentId: number;
  copied: boolean;
  onCopy: (session: Session) => void;
  onDelete: (session: Session) => void;
}
function SessionActions({
  session,
  assessmentId,
  copied,
  onCopy,
  onDelete,
}: SessionActionsProps) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {session.status === "pending" && !isExpired(session) && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onCopy(session)}
          className="rounded-lg"
        >
          {copied ? (
            <>
              <Check className="mr-1.5 h-4 w-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="mr-1.5 h-4 w-4" />
              Copy Link
            </>
          )}
        </Button>
      )}
      {session.status === "active" && (
        <Button
          type="button"
          size="sm"
          onClick={() =>
            navigate(
              `/assessments/${assessmentId}/sessions/${session.id}/monitor`
            )
          }
          className="rounded-lg"
        >
          <Eye className="mr-1.5 h-4 w-4" />
          Monitor
        </Button>
      )}
      {session.status === "ended" &&
        session.end_reason !== "error" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(
                `/assessments/${assessmentId}/sessions/${session.id}/portfolio`
              )
            }
            className="rounded-lg"
          >
            Results
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={session.status === "active"}
        title={
          session.status === "active"
            ? "Active interview cannot be deleted"
            : "Delete candidate"
        }
        aria-label={`Delete ${session.candidate_name || "candidate"}`}
        onClick={() => onDelete(session)}
        className="h-9 w-9 rounded-lg p-0 text-slate-400 hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
export default function AssessmentInvitePage() {
  const { id } = useParams<{ id: string }>();
  const assessmentId = Number(id);
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(true);
  const [assessmentError, setAssessmentError] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [meta, setMeta] = useState<CandidateSessionsMeta>(initialMeta);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [expirationChoice, setExpirationChoice] = useState<ExpirationChoice>(3);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("17:00");
  const [creatingSession, setCreatingSession] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [newSession, setNewSession] = useState<Session | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(
    null
  );
  const [deletingSession, setDeletingSession] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const requestId = useRef(0);
  const loadSessions = useCallback(
    async (showLoading = true) => {
      if (!Number.isInteger(assessmentId) || assessmentId <= 0) {
        return;
      }
      const currentRequest = ++requestId.current;
      if (showLoading) {
        setSessionsLoading(true);
      }
      try {
        const response = await assessmentsApi.getSessions(
          assessmentId,
          page,
          debouncedSearch
        );
        if (currentRequest !== requestId.current) return;
        setSessions(response.data.sessions);
        setMeta(response.data.meta);
        setSessionsError(false);
      } catch {
        if (currentRequest === requestId.current) {
          setSessionsError(true);
        }
      } finally {
        if (currentRequest === requestId.current) {
          setSessionsLoading(false);
        }
      }
    },
    [assessmentId, page, debouncedSearch]
  );
  useEffect(() => {
    let cancelled = false;
    if (!Number.isInteger(assessmentId) || assessmentId <= 0) {
      setAssessmentError(true);
      setAssessmentLoading(false);
      return;
    }
    setAssessmentLoading(true);
    setAssessmentError(false);
    assessmentsApi
      .get(assessmentId)
      .then((response) => {
        if (!cancelled) {
          setAssessment(response.data.assessment);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAssessmentError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAssessmentLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [assessmentId]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    void loadSessions(true);
    return () => {
      requestId.current += 1;
    };
  }, [loadSessions]);
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadSessions(false);
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [loadSessions]);
  const copyLink = async (session: Session) => {
    setCopyError(null);
    if (!session.invite_url) {
      setCopyError("The invitation link is not available.");
      return;
    }
    try {
      await navigator.clipboard.writeText(session.invite_url);
      setCopiedId(session.id);
      window.setTimeout(() => {
        setCopiedId((current) =>
          current === session.id ? null : current
        );
      }, 2000);
    } catch {
      setCopyError(
        "Unable to copy the link. Please copy it manually."
      );
    }
  };
  const openInviteDialog = () => {
    setCandidateName("");
    setCandidateEmail("");
    setExpirationChoice(3);
    setCustomDate("");
    setCustomTime("17:00");
    setInviteError(null);
    setInviteOpen(true);
  };
  const handleInvite = async () => {
    if (creatingSession) return;

    let expiresAt: string | undefined;
    if (expirationChoice === "custom") {
      const iso = customExpirationIso(customDate, customTime);
      if (!iso) {
        setInviteError("Please select a valid expiration date and time (WIB).");
        return;
      }
      if (new Date(iso).getTime() <= Date.now()) {
        setInviteError("Expiration must be in the future.");
        return;
      }
      expiresAt = iso;
    }

    const email = candidateEmail.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError("Please enter a valid candidate email address.");
      return;
    }

    setCreatingSession(true);
    setInviteError(null);
    setNewSession(null);
    try {
      const response = await assessmentsApi.createSession(
        assessmentId,
        candidateName.trim() || undefined,
        undefined,
        {
          candidateEmail: email || undefined,
          ...(expiresAt
            ? { expiresAt }
            : { expirationDays: expirationChoice as 1 | 3 | 7 }),
        }
      );
      const created: Session = {
        ...response.data.session,
        invite_url:
          response.data.session.invite_url ||
          response.data.invite_url,
      };
      setNewSession(created);
      setInviteOpen(false);
      setCandidateName("");
      setCandidateEmail("");
      setCustomDate("");
      setSearch("");
      setDebouncedSearch("");
      setPage(1);
      const sessionsResponse = await assessmentsApi.getSessions(
        assessmentId,
        1,
        ""
      );
      setSessions(sessionsResponse.data.sessions);
      setMeta(sessionsResponse.data.meta);
      setSessionsError(false);
    } catch (error) {
      setInviteError(
        getErrorMessage(
          error,
          "Unable to create the invitation. Please try again."
        )
      );
    } finally {
      setCreatingSession(false);
    }
  };
  const handleDelete = async () => {
    if (!sessionToDelete || deletingSession) return;
    if (sessionToDelete.status === "active") return;
    setDeletingSession(true);
    setDeleteError(null);
    try {
      await sessionsApi.delete(sessionToDelete.id);
      if (newSession?.id === sessionToDelete.id) {
        setNewSession(null);
      }
      setSessionToDelete(null);
      if (sessions.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await loadSessions(true);
      }
    } catch (error) {
      setDeleteError(
        getErrorMessage(
          error,
          "Unable to delete this candidate."
        )
      );
    } finally {
      setDeletingSession(false);
    }
  };
  const startItem =
    meta.total_count === 0
      ? 0
      : (meta.current_page - 1) * meta.per_page + 1;
  const endItem = Math.min(
    meta.current_page * meta.per_page,
    meta.total_count
  );
  if (assessmentLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }
  if (assessmentError || !assessment) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <h1 className="mt-5 text-xl font-bold text-slate-900">
          Unable to load assessment
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          The assessment could not be loaded.
        </p>
        <Button
          className="mt-6 rounded-xl"
          onClick={() => navigate("/assessments")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Assessments
        </Button>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div className="space-y-5">
        <Link
          to="/assessments"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Assessments
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-primary">
              Assessment / Candidates
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              {assessment.name}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Manage invitations and monitor interview progress.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                navigate(`/assessments/${assessmentId}/edit`)
              }
              className="h-11 rounded-xl bg-white px-5"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit Assessment
            </Button>
            <Button
              type="button"
              onClick={openInviteDialog}
              disabled={creatingSession}
              className="h-11 rounded-xl px-5 shadow-sm shadow-primary/20"
            >
              <Plus className="mr-2 h-4 w-4" />
              Invite Candidate
            </Button>
          </div>
        </div>
      </div>
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-start justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Total Candidates
            </p>
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
              {sessionsError ? "—" : meta.total_count}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {debouncedSearch
                ? "Matching candidates"
                : "Interview invitations"}
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Users className="h-6 w-6" />
          </div>
        </div>
        <div className="flex items-start justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Interview Duration
            </p>
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
              {assessment.time_limit_min}
              <span className="ml-1 text-base font-medium text-slate-400">
                min
              </span>
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Per candidate session
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
            <Clock3 className="h-6 w-6" />
          </div>
        </div>
        <div className="flex items-start justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Skills Assessed
            </p>
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
              {assessment.skills?.length ?? 0}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Defined competencies
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
            <Layers3 className="h-6 w-6" />
          </div>
        </div>
      </section>
      <CandidateSessionStatistics
  sessionCounts={
    sessionsError
      ? undefined
      : meta.session_counts
  }
  loading={
    sessionsLoading &&
    !meta.session_counts
  }
/>
      {newSession && (
        <section className="rounded-2xl border border-primary/25 bg-primary/5 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Link2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Invitation link is ready
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {newSession.candidate_email
                    ? `An invitation email has been queued for ${newSession.candidate_email}. You can also copy the link below.`
                    : newSession.candidate_name
                      ? `Share this link with ${newSession.candidate_name}.`
                      : "Share this link with your candidate."}
                  {newSession.expires_at && (
                    <span className="mt-1 block font-medium text-primary">
                      Expires: {formatExpiryWib(newSession.expires_at)}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="min-w-0 flex-1 rounded-xl border border-primary/15 bg-white px-4 py-3">
                  <p className="truncate font-mono text-xs text-slate-600">
                    {newSession.invite_url}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => copyLink(newSession)}
                  className="h-11 rounded-xl px-5"
                >
                  {copiedId === newSession.id ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {copiedId === newSession.id
                    ? "Copied"
                    : "Copy Link"}
                </Button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNewSession(null)}
              aria-label="Dismiss invitation"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-5 border-b border-slate-100 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Candidates
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Manage invitations and track interview status.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={sessionsLoading}
              onClick={() => void loadSessions(true)}
              className="rounded-lg"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  sessionsLoading ? "animate-spin" : ""
                }`}
              />
              Refresh
            </Button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search candidates..."
              aria-label="Search candidates"
              className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-11 pr-10"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {copyError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {copyError}
            </div>
          )}
        </div>
        {sessionsError ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <AlertCircle className="h-9 w-9 text-red-500" />
            <p className="mt-4 font-semibold text-slate-900">
              Unable to load candidates
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Please try again.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadSessions(true)}
              className="mt-5 rounded-xl"
            >
              Try Again
            </Button>
          </div>
        ) : sessionsLoading ? (
          <div className="space-y-4 p-6">
            {[1, 2, 3, 4].map((item) => (
              <Skeleton
                key={item}
                className="h-16 w-full rounded-xl"
              />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {debouncedSearch ? (
                <Search className="h-7 w-7" />
              ) : (
                <UserRound className="h-7 w-7" />
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {debouncedSearch
                ? "No candidates found"
                : "No candidates yet"}
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              {debouncedSearch
                ? `No candidates match "${debouncedSearch}".`
                : "Create an invitation link to start interviewing candidates."}
            </p>
            {debouncedSearch ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                className="mt-6 rounded-xl"
              >
                Clear Search
              </Button>
            ) : (
              <Button
                type="button"
                onClick={openInviteDialog}
                className="mt-6 rounded-xl"
              >
                <Plus className="mr-2 h-4 w-4" />
                Invite Candidate
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left">
                <thead className="border-b border-slate-100 bg-slate-50/80">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Candidate
                    </th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Status
                    </th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Hiring Status
                    </th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Started
                    </th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Invitation Expires
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.map((session, index) => {
                    const displayName =
                      session.candidate_name ||
                      `Candidate ${
                        (meta.current_page - 1) *
                          meta.per_page +
                        index +
                        1
                      }`;
                    return (
                      <tr
                        key={session.id}
                        className="transition-colors hover:bg-slate-50/80"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800">
                                {displayName}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {session.candidate_email ?? "-"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <SessionStatus session={session} />
                        </td>
                        <td className="px-5 py-4">
                          <HiringDecisionBadge session={session} />
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-500">
                          {formatSessionDate(session.started_at)}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                          {formatExpiryWib(session.expires_at)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end">
                            <SessionActions
                              session={session}
                              assessmentId={assessmentId}
                              copied={copiedId === session.id}
                              onCopy={copyLink}
                              onDelete={(selected) => {
                                setDeleteError(null);
                                setSessionToDelete(selected);
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-100 md:hidden">
              {sessions.map((session, index) => {
                const displayName =
                  session.candidate_name ||
                  `Candidate ${
                    (meta.current_page - 1) * meta.per_page +
                    index +
                    1
                  }`;
                return (
                  <div
                    key={session.id}
                    className="space-y-4 p-5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-semibold text-slate-900">
                          {displayName}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {session.started_at
                            ? new Date(
                                session.started_at
                              ).toLocaleDateString()
                            : "Not started"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <SessionStatus session={session} />
                      <HiringDecisionBadge session={session} />
                    </div>
                    <p className="text-xs text-slate-500">
                      Expires: {formatExpiryWib(session.expires_at)}
                    </p>
                    <SessionActions
                      session={session}
                      assessmentId={assessmentId}
                      copied={copiedId === session.id}
                      onCopy={copyLink}
                      onDelete={(selected) => {
                        setDeleteError(null);
                        setSessionToDelete(selected);
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col gap-4 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-xs text-slate-500">
                Showing {startItem}–{endItem} of{" "}
                {meta.total_count}
              </p>
              {meta.total_pages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || sessionsLoading}
                    onClick={() =>
                      setPage((current) =>
                        Math.max(1, current - 1)
                      )
                    }
                    className="rounded-lg"
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Button>
                  <span className="px-2 text-xs text-slate-500">
                    Page {meta.current_page} of{" "}
                    {meta.total_pages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      page >= meta.total_pages ||
                      sessionsLoading
                    }
                    onClick={() =>
                      setPage((current) =>
                        Math.min(
                          meta.total_pages,
                          current + 1
                        )
                      )
                    }
                    className="rounded-lg"
                  >
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </section>
      {assessment.skills && assessment.skills.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Skills Assessed
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Competencies evaluated during the interview.
              </p>
            </div>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
            {assessment.skills.map((skill) => (
              <div
                key={skill.id ?? skill.skill_label}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Layers3 className="h-4 w-4" />
                  </div>
                  <span className="break-words text-sm font-semibold text-slate-800">
                    {skill.skill_label}
                  </span>
                </div>
                <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  {LEVEL_LABELS[skill.expected_level] ??
                    `L${skill.expected_level}`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          if (!creatingSession) {
            setInviteOpen(open);
            setInviteError(null);
          }
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UserRound className="h-6 w-6" />
            </div>
            <DialogTitle>Invite Candidate</DialogTitle>
            <DialogDescription>
              Generate a unique interview link and choose when it expires.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleInvite();
            }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="candidate-name">
                Candidate Name
              </Label>
              <Input
                id="candidate-name"
                placeholder="e.g. Budi Santoso"
                value={candidateName}
                onChange={(event) =>
                  setCandidateName(event.target.value)
                }
                disabled={creatingSession}
                autoFocus
                className="h-11 rounded-xl"
              />
              {/* <p className="text-xs leading-5 text-slate-500">
                Optional. Helps you identify the interview
                session later.
              </p> */}
            </div>
            <div className="space-y-2">
              <Label htmlFor="candidate-email">Candidate Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <Input
                  id="candidate-email"
                  type="email"
                  placeholder="e.g. budi\@example.com"
                  value={candidateEmail}
                  onChange={(event) => setCandidateEmail(event.target.value)}
                  disabled={creatingSession}
                  className="h-11 rounded-xl pl-10"
                />
              </div>
              <p className="text-xs leading-5 text-slate-500">
               An invitation email and one automatic reminder will
                be sent when an address is provided.
              </p>
            </div>
            <div className="space-y-3">
              <Label>Invitation Expiration</Label>
              <div className="grid grid-cols-4 gap-2">
                {([1, 3, 7, "custom"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={creatingSession}
                    aria-pressed={expirationChoice === option}
                    onClick={() => {
                      setExpirationChoice(option);
                      setInviteError(null);
                    }}
                    className={`min-h-11 rounded-xl border px-1 text-xs font-semibold transition-colors sm:text-sm ${
                      expirationChoice === option
                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                        : "border-slate-200 bg-white text-slate-600 hover:border-primary/50"
                    }`}
                  >
                    {option === "custom" ? "Custom" : `${option} day${option === 1 ? "" : "s"}`}
                  </button>
                ))}
              </div>
              {expirationChoice === "custom" && (
                <div className="grid gap-3 rounded-xl border border-primary/15 bg-primary/5 p-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="expiration-date">Expiration Date</Label>
                    <Input
                      id="expiration-date"
                      type="date"
                      min={todayWib()}
                      value={customDate}
                      onChange={(event) => setCustomDate(event.target.value)}
                      disabled={creatingSession}
                      required
                      className="h-11 rounded-xl bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiration-time">Time (WIB)</Label>
                    <Input
                      id="expiration-time"
                      type="time"
                      value={customTime}
                      onChange={(event) => setCustomTime(event.target.value)}
                      disabled={creatingSession}
                      required
                      className="h-11 rounded-xl bg-white"
                    />
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-500">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  {expirationChoice === "custom"
                    ? customDate && customExpirationIso(customDate, customTime)
                      ? `The candidate must start before ${formatExpiryWib(customExpirationIso(customDate, customTime))}.`
                      : "Choose the expiration date and time in WIB (UTC+7)."
                    : `The candidate must start within ${expirationChoice} day${expirationChoice === 1 ? "" : "s"}.`}
                  {" "}An interview already in progress will not be interrupted.
                </p>
              </div>
            </div>
            {inviteError && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {inviteError}
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={creatingSession}
                onClick={() => setInviteOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creatingSession || (expirationChoice === "custom" && (!customDate || !customExpirationIso(customDate, customTime)))}
                className="rounded-xl"
              >
                {creatingSession ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="mr-2 h-4 w-4" />
                )}
                {creatingSession
                  ? "Creating..."
                  : "Create Link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(sessionToDelete)}
        onOpenChange={(open) => {
          if (!open && !deletingSession) {
            setSessionToDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Trash2 className="h-6 w-6" />
            </div>
            <DialogTitle>Delete Candidate?</DialogTitle>
            <DialogDescription>
              Candidate{" "}
              <span className="font-semibold text-slate-800">
                {sessionToDelete?.candidate_name ||
                  "Unnamed candidate"}
              </span>{" "}
              and the related interview session will be
              deleted. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {deleteError}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={deletingSession}
              onClick={() => {
                setSessionToDelete(null);
                setDeleteError(null);
              }}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingSession}
              onClick={handleDelete}
              className="rounded-xl"
            >
              {deletingSession && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete Candidate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
