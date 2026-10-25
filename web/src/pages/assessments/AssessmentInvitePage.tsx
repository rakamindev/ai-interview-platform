import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
  ArrowLeft,
  Copy,
  Check,
  Eye,
  Pencil,
  Clock,
  Plus,
  UserRound,
  RotateCcw,
  Loader2,
  Download,
  Upload,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import type { Assessment, Session } from "@/types";

function SessionRow({
  session,
  index,
  assessmentId,
  onCopy,
  copiedId,
  onReopen,
  reopeningId,
}: {
  session: Session;
  index: number;
  assessmentId: string;
  onCopy: (id: number) => void;
  copiedId: number | null;
  onReopen: (id: number) => void;
  reopeningId: number | null;
}) {
  const navigate = useNavigate();
  const isLive = session.status === "active";
  const isEnded = session.status === "ended";
  const isPending = session.status === "pending";
  const displayName = session.candidate_name || `Candidate ${index}`;

  return (
    <div className="flex items-center justify-between py-3 px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-medium text-muted-foreground">
          {index}
        </div>
        <div className="space-y-0.5">
          <div className="text-sm font-medium">{displayName}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
            {session.candidate_email && <span>{session.candidate_email}</span>}
            {session.candidate_email && session.started_at && <span>•</span>}
            {session.started_at && (
              <span>{new Date(session.started_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isPending && (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Awaiting candidate
          </span>
        )}
        {isLive && (
          <span className="flex items-center gap-1 text-xs text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Live
          </span>
        )}
        {isEnded && session.end_reason === "error" && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
            Failed
          </span>
        )}
        {isEnded && session.end_reason !== "error" && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Completed
          </span>
        )}

        <div className="flex items-center gap-1.5">
          {isPending && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onCopy(session.id)}
            >
              {copiedId === session.id ? (
                <><Check className="h-3 w-3 mr-1" /> Copied</>
              ) : (
                <><Copy className="h-3 w-3 mr-1" /> Copy link</>
              )}
            </Button>
          )}
          {isLive && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/monitor`)}
            >
              <Eye className="h-3 w-3 mr-1" /> Monitor
            </Button>
          )}
          {isEnded && session.end_reason !== "error" && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/portfolio`)}
            >
              Results
            </Button>
          )}
          {isEnded && session.end_reason === "error" && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
              onClick={() => onReopen(session.id)}
              disabled={reopeningId === session.id}
            >
              {reopeningId === session.id ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Re-opening...</>
              ) : (
                <><RotateCcw className="h-3 w-3 mr-1" /> Re-open</>
              )}
            </Button>
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
  const [candidateEmailInput, setCandidateEmailInput] = useState("");
  const [reopeningId, setReopeningId] = useState<number | null>(null);

  // Bulk CSV invite states
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<Array<{ name: string; email: string; valid: boolean; error?: string }>>([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    const res = await assessmentsApi.getSessions(Number(id));
    setSessions(res.data.sessions);
  }, [id]);

  const handleReopen = async (sessionId: number) => {
    setReopeningId(sessionId);
    try {
      await sessionsApi.reopen(sessionId);
      await loadSessions();
    } catch (err) {
      console.error("Failed to re-open session:", err);
    } finally {
      setReopeningId(null);
    }
  };

  const exportInviteLinksCsv = () => {
    if (!sessions || sessions.length === 0) return;
    const headers = ["Candidate Name", "Email", "Status", "Invite URL", "Created At"];
    const rows = sessions.map((s) => [
      s.candidate_name || "Candidate",
      s.candidate_email || "",
      s.status,
      s.invite_url,
      s.created_at ? new Date(s.created_at).toISOString() : ""
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(","))
    ].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeName = (assessment?.name || "assessment").toLowerCase().replace(/[^a-z0-9]/g, "-");
    link.setAttribute("download", `${safeName}-candidate-invites.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseCsvText = (text: string) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) {
      setBulkError("Uploaded CSV file is empty");
      setBulkPreview([]);
      return;
    }

    const headerLine = lines[0];
    const rawHeaders = headerLine.split(",").map((h) => h.replace(/^["']|["']$/g, "").trim().toLowerCase());

    let nameIdx = rawHeaders.findIndex((h) => h.includes("name"));
    let emailIdx = rawHeaders.findIndex((h) => h.includes("email"));

    let dataLines = lines.slice(1);
    if (nameIdx === -1 && emailIdx === -1) {
      nameIdx = 0;
      emailIdx = 1;
      dataLines = lines;
    } else {
      if (nameIdx === -1) nameIdx = 0;
      if (emailIdx === -1) emailIdx = 1;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const parsed: Array<{ name: string; email: string; valid: boolean; error?: string }> = [];

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      const parts = line.split(",").map((p) => p.replace(/^["']|["']$/g, "").trim());
      const name = parts[nameIdx] || "";
      const email = parts[emailIdx] || "";

      if (!name) {
        parsed.push({ name, email, valid: false, error: "Missing candidate name" });
      } else if (email && !emailRegex.test(email)) {
        parsed.push({ name, email, valid: false, error: "Invalid email format" });
      } else {
        parsed.push({ name, email, valid: true });
      }
    }

    setBulkPreview(parsed);
    if (parsed.length === 0) {
      setBulkError("No candidates found in file");
    } else {
      setBulkError(null);
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        parseCsvText(content);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleBatchCreate = async () => {
    const validCandidates = bulkPreview.filter((c) => c.valid).map((c) => ({
      name: c.name,
      email: c.email || undefined,
    }));
    if (validCandidates.length === 0) return;
    setBulkImporting(true);
    setBulkError(null);
    try {
      await assessmentsApi.batchCreateSessions(Number(id), validCandidates);
      await loadSessions();
      setShowBulkDialog(false);
      setBulkPreview([]);
    } catch {
      setBulkError("Failed to import candidate batch. Please check format.");
    } finally {
      setBulkImporting(false);
    }
  };

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
    setCandidateEmailInput("");
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
        candidateEmailInput.trim() || undefined
      );
      const created = res.data.session;
      setNewSession(created);
      setSessions((prev) => [created, ...prev]);
    } finally {
      setCreatingSession(false);
    }
  };

  const copyLink = (session: Session, id: number) => {
    navigator.clipboard.writeText(session.invite_url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyNewSessionLink = () => {
    if (!newSession?.invite_url) return;
    navigator.clipboard.writeText(newSession.invite_url);
    setNewSessionCopied(true);
    setTimeout(() => setNewSessionCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Link to="/assessments" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">{assessment?.name ?? "—"}</h1>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Clock className="h-3 w-3" />
              {assessment?.time_limit_min} min · {assessment?.skills?.length ?? 0} skills
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => navigate(`/assessments/${id}/edit`)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBulkPreview([]);
              setBulkError(null);
              setShowBulkDialog(true);
            }}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Bulk Invite (CSV)
          </Button>
          <Button size="sm" onClick={openInviteDialog} disabled={creatingSession}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {creatingSession ? "Creating..." : "Invite Candidate"}
          </Button>
        </div>
      </div>

      {/* Invite candidate dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="candidate-name">Candidate name</Label>
              <Input
                id="candidate-name"
                placeholder="e.g. Budi Santoso"
                value={candidateNameInput}
                onChange={(e) => setCandidateNameInput(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="candidate-email">Candidate email (optional)</Label>
              <Input
                id="candidate-email"
                type="email"
                placeholder="e.g. budi@example.com"
                value={candidateEmailInput}
                onChange={(e) => setCandidateEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInviteCandidate()}
              />
            </div>
            <p className="text-xs text-muted-foreground">Helps identify and track candidate sessions.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
            <Button onClick={handleInviteCandidate} disabled={creatingSession}>
              {creatingSession ? "Creating..." : "Create Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk invite dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Bulk Invite Candidates via CSV
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Upload a <code>.csv</code> file containing candidate names and optional email addresses.
              The CSV should have column headers like <code>name, email</code>.
            </p>

            <div className="border-2 border-dashed border-border rounded-lg p-5 text-center hover:bg-muted/30 transition-colors cursor-pointer relative">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">
                Click to browse or drag and drop CSV file here
              </p>
              <p className="text-xs text-muted-foreground mt-1">Supports up to 500 candidates per batch</p>
            </div>

            {bulkError && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{bulkError}</span>
              </div>
            )}

            {bulkPreview.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    Parsed: {bulkPreview.length} total (
                    <span className="text-green-600 font-semibold">{bulkPreview.filter((c) => c.valid).length} valid</span>,{" "}
                    <span className="text-destructive font-semibold">{bulkPreview.filter((c) => !c.valid).length} invalid</span>)
                  </span>
                  <span className="text-muted-foreground">Showing preview</span>
                </div>

                <div className="max-h-48 overflow-y-auto border rounded-md text-xs divide-y">
                  {bulkPreview.slice(0, 50).map((row, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2">
                      <div className="truncate mr-2">
                        <span className="font-medium">{row.name || "—"}</span>
                        {row.email && <span className="text-muted-foreground ml-2">({row.email})</span>}
                      </div>
                      {row.valid ? (
                        <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-[11px] font-medium shrink-0">
                          Valid
                        </span>
                      ) : (
                        <span className="text-destructive bg-destructive/10 px-2 py-0.5 rounded text-[11px] font-medium shrink-0">
                          {row.error || "Invalid"}
                        </span>
                      )}
                    </div>
                  ))}
                  {bulkPreview.length > 50 && (
                    <div className="p-2 text-center text-muted-foreground text-[11px]">
                      + {bulkPreview.length - 50} more candidates in file
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>Cancel</Button>
            <Button
              onClick={handleBatchCreate}
              disabled={bulkPreview.filter((c) => c.valid).length === 0 || bulkImporting}
            >
              {bulkImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                `Generate ${bulkPreview.filter((c) => c.valid).length} Invites`
              )}
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
                {newSession.invite_url}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={copyNewSessionLink} className="w-full">
              {newSessionCopied ? (
                <><Check className="h-3.5 w-3.5 mr-1.5" /> Copied!</>
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
          {sessions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={exportInviteLinksCsv}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export Invite Links (CSV)
            </Button>
          )}
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
          <Card>
            <CardContent className="p-0 divide-y">
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
                  onReopen={handleReopen}
                  reopeningId={reopeningId}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Assessment skills detail */}
      {assessment?.skills && assessment.skills.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Skills assessed</h2>
            <ul className="space-y-1">
              {assessment.skills.map((s) => (
                <li key={s.id ?? s.skill_label} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>•</span>
                  <span>{s.skill_label}</span>
                  <span className="text-xs">(expected {LEVEL_LABELS[s.expected_level]})</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
