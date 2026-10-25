import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assessmentsApi } from "@/services/assessments";
import { sessionsApi } from "@/services/sessions";
import { LEVEL_LABELS } from "@/utils/constants";
import {
  Copy,
  Check,
  Eye,
  Pencil,
  Clock,
  Plus,
  Link2,
  Activity,
  Users,
  BarChart3,
  TrendingUp,
  Info,
  FileText,
  ExternalLink,
} from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import EmptyState from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { Assessment, Session } from "@/types";

function inviteLinkFor(token: string): string {
  return `${window.location.origin}/interview/${token}`;
}

const AVATAR_COLORS = [
  { bg: "bg-teal-50", text: "text-teal-700" },
  { bg: "bg-blue-50", text: "text-blue-700" },
  { bg: "bg-purple-50", text: "text-purple-700" },
  { bg: "bg-amber-50", text: "text-amber-700" },
  { bg: "bg-rose-50", text: "text-rose-700" },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function StatusBadge({
  status,
  endReason,
}: {
  status: Session["status"];
  endReason?: string;
}) {
  const configs = {
    pending: {
      dot: "bg-amber-400",
      text: "text-amber-700",
      bg: "bg-amber-50",
      label: "Awaiting",
    },
    active: {
      dot: "bg-blue-500 animate-pulse",
      text: "text-blue-700",
      bg: "bg-blue-50",
      label: "Live",
    },
    ended_error: {
      dot: "bg-red-500",
      text: "text-red-700",
      bg: "bg-red-50",
      label: "Failed",
    },
    ended_ok: {
      dot: "bg-teal-500",
      text: "text-teal-700",
      bg: "bg-teal-50",
      label: "Completed",
    },
  };

  const key =
    status === "ended"
      ? endReason === "error"
        ? "ended_error"
        : "ended_ok"
      : status;

  const c = configs[key];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold",
        c.bg,
        c.text
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  );
}

export default function AssessmentInvitePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSession, setNewSession] = useState<Session | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [newSessionCopied, setNewSessionCopied] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [candidateNameInput, setCandidateNameInput] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [coverageSummary, setCoverageSummary] = useState<{
    covered: number;
    total: number;
  } | null>(null);

  const loadSessions = useCallback(async () => {
    const res = await assessmentsApi.getSessions(Number(id));
    setSessions(res.data.sessions);
  }, [id]);

  useEffect(() => {
    Promise.all([
      assessmentsApi.get(Number(id)),
      assessmentsApi.getSessions(Number(id)),
    ])
      .then(([aRes, sRes]) => {
        setAssessment(aRes.data.assessment);
        setSessions(sRes.data.sessions);
      })
      .catch(() => {
        setLoadError("Failed to load assessment data.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const hasActive = sessions.some((s) => s.status !== "ended");
    if (!hasActive) return;
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, [sessions, loadSessions]);

  // Fetch coverage for completed sessions to compute "skills covered" stat
  useEffect(() => {
    const completedSessions = sessions.filter(
      (s) => s.status === "ended" && s.end_reason !== "error"
    );
    if (completedSessions.length === 0) {
      setCoverageSummary(null);
      return;
    }

    const totalSkills = assessment?.skills?.length ?? 0;
    if (totalSkills === 0) {
      setCoverageSummary({ covered: 0, total: 0 });
      return;
    }

    Promise.allSettled(
      completedSessions.map((s) => sessionsApi.getCoverage(s.id))
    ).then((results) => {
      const coveredSkills = new Set<string>();
      for (const r of results) {
        if (r.status === "fulfilled") {
          for (const sk of r.value.data.skills ?? []) {
            if (sk.state === "covered" || sk.state === "partial") {
              coveredSkills.add(sk.skill_label);
            }
          }
        }
      }
      setCoverageSummary({ covered: coveredSkills.size, total: totalSkills });
    });
  }, [sessions, assessment]);

  const stats = useMemo(() => {
    const total = sessions.length;
    const completed = sessions.filter(
      (s) => s.status === "ended" && s.end_reason !== "error"
    ).length;
    const failed = sessions.filter(
      (s) => s.status === "ended" && s.end_reason === "error"
    ).length;
    const pending = total - completed - failed;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, failed, pending, rate };
  }, [sessions]);

  const openInviteDialog = () => {
    setCandidateNameInput("");
    setShowInviteDialog(true);
  };

  const handleInviteCandidate = async () => {
    setCreatingSession(true);
    setShowInviteDialog(false);
    setNewSession(null);
    try {
      const res = await assessmentsApi.createSession(
        Number(id),
        candidateNameInput.trim() || undefined
      );
      const created = res.data.session;
      setNewSession(created);
      setSessions((prev) => [created, ...prev]);
    } finally {
      setCreatingSession(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  const copyLink = (session: Session, sessionId: number) => {
    copyToClipboard(inviteLinkFor(session.invite_token));
    setCopiedId(sessionId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyNewSessionLink = () => {
    if (!newSession?.invite_token) return;
    copyToClipboard(inviteLinkFor(newSession.invite_token));
    setNewSessionCopied(true);
    setTimeout(() => setNewSessionCopied(false), 2000);
  };

  const formatDate = (d?: string) =>
    d
      ? new Date(d).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-5">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <Breadcrumb items={[{ label: "Assessments", href: "/assessments" }]} />
        <div className="border rounded-xl p-8 text-center space-y-3">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/assessments")}
          >
            Back to Assessments
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Assessments", href: "/assessments" },
          { label: assessment?.name ?? "—" },
        ]}
      />

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">{assessment?.name ?? "—"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {assessment?.time_limit_min} min &middot;{" "}
            {assessment?.language === "id" ? "Indonesian" : "English"} &middot;{" "}
            {assessment?.skills?.length ?? 0} skills
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/assessments/${id}/edit`)}
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
          <Button size="sm" onClick={openInviteDialog} disabled={creatingSession}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {creatingSession ? "Creating..." : "New session"}
          </Button>
        </div>
      </div>

      {/* Invite dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="candidate-name">Candidate name</Label>
            <Input
              id="candidate-name"
              placeholder="e.g. Budi Santoso"
              value={candidateNameInput}
              onChange={(e) => setCandidateNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInviteCandidate()}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Optional — helps you identify this session later.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInviteDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleInviteCandidate}>Create Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New session link banner */}
      {newSession && (
        <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3">
          <Link2 className="w-5 h-5 text-teal-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-teal-800">
              {newSession.candidate_name
                ? `Link for ${newSession.candidate_name} ready`
                : "New session link ready"}
            </p>
            <p className="text-xs text-teal-600 mt-0.5">
              Share this link with your candidate to start the interview
            </p>
          </div>
          <button
            onClick={copyNewSessionLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-white border border-teal-200 rounded-md hover:bg-teal-50 transition-colors flex-shrink-0"
          >
            {newSessionCopied ? (
              <>
                <Check className="h-3.5 w-3.5" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copy link
              </>
            )}
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
            Total candidates
          </div>
          <div className="text-2xl font-semibold text-gray-900">
            {stats.total}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {stats.completed} completed &middot; {stats.pending} pending
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
            Completed
          </div>
          <div className="text-2xl font-semibold text-gray-900">
            {stats.completed}
            <span className="text-base font-normal text-gray-400">%</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {stats.rate}% completion rate
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
            Skills covered
          </div>
          <div className="text-2xl font-semibold text-gray-900">
            {coverageSummary ? (
              <>
                {coverageSummary.covered}
                <span className="text-base font-normal text-gray-400">
                  /{coverageSummary.total}
                </span>
              </>
            ) : (
              <span className="text-gray-400 text-lg">—</span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {coverageSummary
              ? `${coverageSummary.total > 0 ? Math.round((coverageSummary.covered / coverageSummary.total) * 100) : 0}% of skills addressed`
              : "No completed sessions yet"}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
        {/* Main: Candidates table */}
        <div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-900">
                Candidates
              </span>
            </div>

            {sessions.length === 0 ? (
              <EmptyState
                icon={<Users className="h-6 w-6 text-muted-foreground" />}
                title="No candidates yet"
                description="Click 'New session' to generate an interview link."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Name
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Submitted
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session, i) => {
                    const name =
                      session.candidate_name || `Candidate ${sessions.length - i}`;
                    const { bg, text } = getAvatarColor(name);
                    const isPending = session.status === "pending";
                    const isLive = session.status === "active";
                    const isCompleted =
                      session.status === "ended" &&
                      session.end_reason !== "error";

                    return (
                      <tr
                        key={session.id}
                        className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0",
                                bg,
                                text
                              )}
                            >
                              {getInitials(name)}
                            </div>
                            <span className="font-medium text-gray-900">
                              {name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {formatDate(session.started_at)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            status={session.status}
                            endReason={session.end_reason}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPending && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() =>
                                    window.open(
                                      inviteLinkFor(session.invite_token),
                                      "_blank"
                                    )
                                  }
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" /> Open
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => copyLink(session, session.id)}
                                >
                                  {copiedId === session.id ? (
                                    <>
                                      <Check className="h-3 w-3 mr-1" /> Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3 mr-1" /> Copy
                                    </>
                                  )}
                                </Button>
                              </>
                            )}
                            {isLive && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() =>
                                  navigate(
                                    `/assessments/${id}/sessions/${session.id}/monitor`
                                  )
                                }
                              >
                                <Eye className="h-3 w-3 mr-1" /> Monitor
                              </Button>
                            )}
                            {isCompleted && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() =>
                                  navigate(
                                    `/assessments/${id}/sessions/${session.id}/portfolio`
                                  )
                                }
                              >
                                <FileText className="h-3 w-3 mr-1" /> Report
                              </Button>
                            )}
                            {!isPending && !isLive && !isCompleted && (
                              <span className="text-xs text-gray-400">
                                —
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          {/* Assessment info */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-3">
              <Info className="w-4 h-4 text-teal-600" />
              Assessment details
            </div>
            <div className="space-y-0">
              {[
                {
                  k: "Duration",
                  v: `${assessment?.time_limit_min ?? "—"} min`,
                },
                {
                  k: "Language",
                  v: assessment?.language === "id" ? "Indonesian" : "English",
                },
                {
                  k: "Skills",
                  v: `${assessment?.skills?.length ?? 0} assessed`,
                },
                {
                  k: "Created",
                  v: formatDate(assessment?.created_at),
                },
              ].map((row) => (
                <div
                  key={row.k}
                  className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0 text-xs"
                >
                  <span className="text-gray-500">{row.k}</span>
                  <span className="font-medium text-gray-900">{row.v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Skills breakdown */}
          {assessment?.skills && assessment.skills.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-3">
                <BarChart3 className="w-4 h-4 text-teal-600" />
                Skills assessed
              </div>
              <div className="space-y-3">
                {assessment.skills.map((s) => (
                  <div key={s.id ?? s.skill_label}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-medium text-gray-900">
                        {s.skill_label}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {LEVEL_LABELS[s.expected_level]}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full"
                        style={{
                          width: `${(s.expected_level / 5) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
