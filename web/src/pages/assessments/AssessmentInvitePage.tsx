import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { assessmentsApi } from "@/services/assessments";
import { LEVEL_LABELS } from "@/utils/constants";
import { formatDateTime } from "@/utils/dateTime";
import { getInterviewUrl } from "@/utils/url";
import { extractTextFromPdf } from "@/utils/pdfParser";
import { ArrowLeft, Copy, Check, Eye, Pencil, Clock, Plus, UserRound, Upload, FileText, Loader2 } from "lucide-react";
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
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            {index}
          </div>
          <div>
            <div className="font-medium text-foreground">{displayName}</div>
            <div className="text-[11px] font-mono text-muted-foreground">
              Token: {session.invite_token ? `${session.invite_token.slice(0, 8)}...` : `#${session.id}`}
            </div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-xs text-muted-foreground">
        {session.started_at ? formatDateTime(session.started_at) : "Awaiting start"}
      </td>
      <td className="py-3 px-4 text-xs">
        {isPending && (
          <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Awaiting candidate
          </span>
        )}
        {isLive && (
          <span className="inline-flex items-center gap-1 text-primary font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Live now
          </span>
        )}
        {isEnded && session.end_reason === "error" && (
          <span className="inline-flex items-center gap-1 text-destructive font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
            Failed
          </span>
        )}
        {isEnded && session.end_reason !== "error" && (
          <span className="inline-flex items-center gap-1 text-green-600 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Completed
          </span>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {isPending && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label={copiedId === session.id ? "Copied" : "Copy link"}
              title={copiedId === session.id ? "Link copied" : "Copy interview link"}
              onClick={() => onCopy(session.id)}
            >
              {copiedId === session.id ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          )}
          {isLive && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 border-blue-500 text-blue-600 hover:bg-blue-50"
              aria-label="Monitor live session"
              title="Monitor live session"
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/monitor`)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          {isEnded && session.end_reason !== "error" && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label="View Portfolio Results"
              title="View Portfolio Results"
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/portfolio`)}
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      </td>
    </tr>
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
  const [candidateCvText, setCandidateCvText] = useState("");
  const [cvFileName, setCvFileName] = useState("");
  const [cvLoading, setCvLoading] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);

  const handleCvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCvFileName(file.name);
    setCvError(null);

    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";

    if (isPdf) {
      setCvLoading(true);
      try {
        const text = await extractTextFromPdf(file);
        if (!text || text.trim().length === 0) {
          setCvError("Could not extract readable text from PDF. If it is a scanned image, please paste the CV text manually below.");
        } else {
          setCandidateCvText(text);
        }
      } catch (err) {
        setCvError("Failed to extract text from PDF document. Please paste the text manually below.");
      } finally {
        setCvLoading(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result;
        if (typeof content === "string") {
          setCandidateCvText(content.trim());
        }
      };
      reader.onerror = () => {
        setCvError("Failed to read text file. Please paste the CV text manually below.");
      };
      reader.readAsText(file);
    }
  };

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
    setCandidateCvText("");
    setCvFileName("");
    setCvError(null);
    setCvLoading(false);
    setShowInviteDialog(true);
  };

  const handleInviteCandidate = async () => {
    setCreatingSession(true);
    setShowInviteDialog(false);
    setNewSession(null);
    try {
      const res = await assessmentsApi.createSession(
        Number(id),
        candidateNameInput.trim() || undefined,
        undefined,
        candidateCvText.trim() || undefined
      );
      const created = res.data.session;
      setNewSession(created);
      setSessions((prev) => [created, ...prev]);
    } finally {
      setCreatingSession(false);
    }
  };

  const copyLink = (session: Session, id: number) => {
    const url = getInterviewUrl(session);
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyNewSessionLink = () => {
    if (!newSession) return;
    const url = getInterviewUrl(newSession);
    if (!url) return;
    navigator.clipboard.writeText(url);
    setNewSessionCopied(true);
    setTimeout(() => setNewSessionCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto w-full space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-5 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
          </CardContent>
        </Card>
        <div className="border rounded-lg overflow-hidden bg-background">
          <div className="p-4 border-b">
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="divide-y">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 flex items-center justify-between">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-8 w-24 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" asChild>
            <Link to="/assessments" title="Back to Assessments">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{assessment?.name ?? "Assessment"}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {assessment?.time_limit_min ?? "—"} min session · {assessment?.skills?.length ?? 0} competencies · Invite candidates and manage interview sessions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/assessments/${id}/edit`)}>
            <Pencil className="h-4 w-4 mr-1.5" /> Edit
          </Button>
          <Button onClick={openInviteDialog} disabled={creatingSession}>
            <Plus className="h-4 w-4 mr-1.5" />
            {creatingSession ? "Creating..." : "Invite Candidate"}
          </Button>
        </div>
      </div>

      {/* Invite candidate dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="candidate-name">Candidate name (Optional)</Label>
              <Input
                id="candidate-name"
                placeholder="e.g. Budi Santoso"
                value={candidateNameInput}
                onChange={(e) => setCandidateNameInput(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Optional — helps you identify this session later.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="candidate-cv-file">Candidate CV / Resume (Optional)</Label>
              <Input
                id="candidate-cv-file"
                type="file"
                accept=".pdf,.txt,.md"
                onChange={handleCvFileUpload}
                disabled={cvLoading}
                className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
              {cvLoading && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Extracting text from PDF...
                </div>
              )}
              {cvError && (
                <p className="text-xs text-destructive">{cvError}</p>
              )}
              {!cvLoading && cvFileName && candidateCvText && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <FileText className="h-3.5 w-3.5" />
                  Parsed: {cvFileName} ({candidateCvText.length} characters)
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Attaches past project evidence for sub-5ms Micro-RAG live interview probing.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="candidate-cv-text">Parsed CV Text</Label>
              <Textarea
                id="candidate-cv-text"
                placeholder="Parsed candidate work history, key projects, and accomplishments will appear here (or paste directly)..."
                rows={4}
                value={candidateCvText}
                onChange={(e) => setCandidateCvText(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
            <Button onClick={handleInviteCandidate} disabled={creatingSession || cvLoading}>
              {creatingSession ? "Creating..." : "Create Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Newly created session invite link */}
      {newSession && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm font-medium">
              {newSession.candidate_name
                ? <>Link for <span className="font-semibold">{newSession.candidate_name}</span> ready — share with your candidate:</>
                : <>New invite link ready — share with your candidate:</>}
            </p>
            <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-white">
              <span className="flex-1 text-sm font-mono truncate text-muted-foreground">
                {getInterviewUrl(newSession)}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={copyNewSessionLink} className="w-full">
              {newSessionCopied ? (
                <><Check className="h-3.5 w-3.5 mr-1.5 text-green-600" /> Copied!</>
              ) : (
                <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy link</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Sessions list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Candidates
            {sessions.length > 0 && (
              <span className="ml-1.5 text-muted-foreground font-normal">({sessions.length})</span>
            )}
          </h2>
        </div>

        {sessions.length === 0 ? (
          <div className="border rounded-lg p-10 text-center space-y-3">
            <UserRound className="h-8 w-8 text-muted-foreground mx-auto" />
            <div>
              <p className="text-sm font-medium">No candidates yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click "Invite Candidate" to generate an interview link.
              </p>
            </div>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-background">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Candidate</th>
                    <th className="py-3 px-4 font-semibold">Session Date</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
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
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Assessment skills detail */}
      {assessment?.skills && assessment.skills.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Skills assessed</h2>
            <div className="border rounded-lg overflow-hidden bg-background">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 border-b text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Competency</th>
                      <th className="py-3 px-4 font-semibold">Expected Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {assessment.skills.map((s) => (
                      <tr key={s.id ?? s.skill_label} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-medium text-foreground">
                          {s.skill_label}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {s.expected_level
                            ? `Level ${s.expected_level} (${LEVEL_LABELS[s.expected_level] || ""})`
                            : "Proficiency Rubric (L1–L5)"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
