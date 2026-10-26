import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { assessmentsApi } from "@/services/assessments";
import { LEVEL_LABELS } from "@/utils/constants";
import { ArrowLeft, Copy, Check, Eye, Pencil, Clock, Plus, UserRound, Loader2, Zap, Sparkles, CheckCircle2 } from "lucide-react";
import type { Assessment, Session } from "@/types";

function SessionRow({
  session,
  index,
  assessmentId,
  onCopy,
  copiedId,
}: {
  session: Session;
  index: number;
  assessmentId: string;
  onCopy: (id: number) => void;
  copiedId: number | null;
}) {
  const navigate = useNavigate();
  const isLive = session.status === "active";
  const isEnded = session.status === "ended";
  const isPending = session.status === "pending";
  const displayName = session.candidate_name || `Candidate ${index}`;

  return (
    <div className="flex items-center justify-between py-3.5 px-4 sm:px-6 hover:bg-emerald-50/40 transition-colors">
      <div className="flex items-center gap-3.5">
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
          #{index}
        </div>
        <div className="space-y-0.5">
          <div className="text-sm font-semibold text-slate-900">{displayName}</div>
          {session.started_at && (
            <div className="text-xs text-slate-400 font-mono">
              Started: {new Date(session.started_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isPending && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Awaiting Candidate
          </span>
        )}
        {isLive && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Interview
          </span>
        )}
        {isEnded && session.end_reason === "error" && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Terminated / Error
          </span>
        )}
        {isEnded && session.end_reason !== "error" && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
            Completed
          </span>
        )}

        <div className="flex items-center gap-2">
          {isPending && (
            <button
              onClick={() => onCopy(session.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 hover:text-emerald-700 transition-all cursor-pointer shadow-sm"
            >
              {copiedId === session.id ? (
                <><Check className="h-3.5 w-3.5 text-emerald-600" /> Copied</>
              ) : (
                <><Copy className="h-3.5 w-3.5 text-slate-400" /> Copy Link</>
              )}
            </button>
          )}
          {isLive && (
            <button
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/monitor`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-sm transition-all cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5" /> Live Monitor
            </button>
          )}
          {isEnded && session.end_reason !== "error" && (
            <button
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/portfolio`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800 transition-all cursor-pointer shadow-sm"
            >
              View Report →
            </button>
          )}
        </div>
      </div>
    </div>
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

  const loadSessions = useCallback(async () => {
    const res = await assessmentsApi.getSessions(Number(id));
    setSessions(res.data.sessions);
  }, [id]);

  useEffect(() => {
    Promise.all([
      assessmentsApi.get(Number(id)),
      assessmentsApi.getSessions(Number(id)),
    ]).then(([aRes, sRes]) => {
      setAssessment(aRes.data.assessment);
      setSessions(sRes.data.sessions);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  // Poll while any session is live or pending
  useEffect(() => {
    const hasActive = sessions.some((s) => s.status !== "ended");
    if (!hasActive) return;
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, [sessions, loadSessions]);

  const openInviteDialog = () => {
    setCandidateNameInput("");
    setShowInviteDialog(true);
  };

  const handleInviteCandidate = async () => {
    setCreatingSession(true);
    setShowInviteDialog(false);
    setNewSession(null);
    try {
      const res = await assessmentsApi.createSession(Number(id), candidateNameInput.trim() || undefined);
      const created = res.data.session;
      setNewSession(created);
      setSessions((prev) => [created, ...prev]);
    } finally {
      setCreatingSession(false);
    }
  };

  const getCandidateUrl = (inviteUrl: string, token: string) => {
    if (token) {
      return `${window.location.origin}/interview/${token}`;
    }
    return inviteUrl;
  };

  const copyLink = (session: Session, sid: number) => {
    const url = getCandidateUrl(session.invite_url, session.invite_token);
    navigator.clipboard.writeText(url);
    setCopiedId(sid);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyNewSessionLink = () => {
    if (!newSession?.invite_url) return;
    const url = getCandidateUrl(newSession.invite_url, newSession.invite_token);
    navigator.clipboard.writeText(url);
    setNewSessionCopied(true);
    setTimeout(() => setNewSessionCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="h-10 w-64 rounded-xl bg-slate-100 animate-pulse" />
        <div className="h-40 w-full rounded-3xl bg-slate-100 animate-pulse" />
        <div className="h-64 w-full rounded-3xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <Link
            to="/assessments"
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-emerald-500/20 bg-white/80 hover:bg-emerald-50/80 text-emerald-700 shadow-sm transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Active Assessment</span>
              <span className="text-slate-300">/</span>
              <span className="text-xs text-slate-500 font-medium">Session Manager</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{assessment?.name ?? "—"}</h1>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span className="flex items-center gap-1 font-medium text-slate-600">
                <Clock className="h-3.5 w-3.5 text-emerald-600" /> {assessment?.time_limit_min} mins
              </span>
              <span>·</span>
              <span className="font-medium text-slate-600">{assessment?.skills?.length ?? 0} competencies</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate(`/assessments/${id}/edit`)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-all cursor-pointer shadow-sm"
          >
            <Pencil className="h-3.5 w-3.5 text-slate-500" /> Edit Template
          </button>
          <button
            onClick={openInviteDialog}
            disabled={creatingSession}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-[0_4px_18px_rgba(16,185,129,0.35)] hover:shadow-[0_6px_22px_rgba(16,185,129,0.45)] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
          >
            {creatingSession ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating Link...</>
            ) : (
              <><Plus className="h-3.5 w-3.5" /> Invite Candidate</>
            )}
          </button>
        </div>
      </div>

      {/* ── Invite Candidate Modal Dialog ── */}
      {showInviteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setShowInviteDialog(false)} />
          <div className="relative w-full max-w-md rounded-3xl border border-emerald-500/20 bg-white/98 backdrop-blur-xl shadow-2xl p-6 space-y-5 overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Generate Candidate Interview Link</h2>
              <p className="text-xs text-slate-500 mt-1">
                Creates a unique, secure session token for this candidate to access the autonomous AI interview.
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="candidate-name" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Candidate Full Name
              </label>
              <input
                id="candidate-name"
                placeholder="e.g. Budi Santoso"
                value={candidateNameInput}
                onChange={(e) => setCandidateNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInviteCandidate()}
                autoFocus
                className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all hover:border-emerald-300"
              />
              <p className="text-[11px] text-slate-400">Optional — helps you identify candidate results later.</p>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowInviteDialog(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 transition-all cursor-pointer shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleInviteCandidate}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-md active:scale-[0.98] transition-all cursor-pointer"
              >
                Create Invitation Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Newly Created Session Banner ── */}
      {newSession && (
        <div className="relative rounded-3xl border border-emerald-500/30 bg-emerald-50/70 backdrop-blur-xl p-6 space-y-3.5 shadow-sm overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <p className="text-sm font-bold text-emerald-950">
              {newSession.candidate_name
                ? <>Session link for <span className="text-emerald-700">{newSession.candidate_name}</span> is ready!</>
                : <>Candidate interview invitation link generated!</>}
            </p>
          </div>
          <div className="flex items-center gap-2 border border-emerald-300/60 rounded-xl px-4 py-2.5 bg-white shadow-inner">
            <span className="flex-1 text-xs font-mono truncate text-slate-700 select-all">
              {getCandidateUrl(newSession.invite_url, newSession.invite_token)}
            </span>
          </div>
          <button
            onClick={copyNewSessionLink}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            {newSessionCopied ? (
              <><Check className="h-4 w-4" /> Link Copied to Clipboard!</>
            ) : (
              <><Copy className="h-4 w-4" /> Copy Invitation Link</>
            )}
          </button>
        </div>
      )}

      {/* ── Candidate Sessions List ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            Candidate Sessions
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {sessions.length}
            </span>
          </h2>
        </div>

        {sessions.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-emerald-500/20 bg-white/80 p-10 text-center space-y-3 shadow-sm">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-600">
              <UserRound className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">No candidate sessions active</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Generate an invitation link to send to prospective applicants for this assessment.
              </p>
            </div>
            <button
              onClick={openInviteDialog}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Invite First Candidate
            </button>
          </div>
        ) : (
          <div className="rounded-3xl border border-emerald-500/20 bg-white/95 backdrop-blur-xl shadow-[0_10px_35px_-8px_rgba(16,185,129,0.08)] overflow-hidden divide-y divide-slate-100">
            {sessions.map((session, i) => (
              <SessionRow
                key={session.id}
                session={session}
                index={sessions.length - i}
                assessmentId={id!}
                onCopy={(sid) => {
                  const s = sessions.find((x) => x.id === sid);
                  if (s) copyLink(s, sid);
                }}
                copiedId={copiedId}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Assessment Skills Detail ── */}
      {assessment?.skills && assessment.skills.length > 0 && (
        <div className="rounded-3xl border border-emerald-500/20 bg-white/95 backdrop-blur-xl p-6 space-y-3 shadow-sm">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-emerald-600" />
            Target Competency Rubric
          </h2>
          <div className="flex flex-wrap gap-2 pt-1">
            {assessment.skills.map((s) => (
              <div
                key={s.id ?? s.skill_label}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              >
                <span className="font-semibold text-slate-800">{s.skill_label}</span>
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                  {LEVEL_LABELS[s.expected_level]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
