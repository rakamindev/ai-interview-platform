import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { sessionsApi } from "@/services/sessions";
import { useToast } from "@/hooks/useToast";
import { useUser } from "@/hooks/useUser";
import { LEVEL_LABELS } from "@/utils/constants";
import {
  Users,
  Copy,
  Check,
  Eye,
  Pencil,
  Plus,
  Radio,
  Sparkles,
  Loader2,
  ListPlus,
} from "lucide-react";
import type { Assessment, Session } from "@/types";

export default function AssessmentInvitePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const { canEdit } = useUser();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [showSingleInvite, setShowSingleInvite] = useState(false);
  const [candidateNameInput, setCandidateNameInput] = useState("");
  const [creatingSingle, setCreatingSingle] = useState(false);

  const [showBulkInvite, setShowBulkInvite] = useState(false);
  const [bulkNamesInput, setBulkNamesInput] = useState("");
  const [creatingBulk, setCreatingBulk] = useState(false);

  const [copiedId, setCopiedId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [aRes, sRes] = await Promise.all([
        assessmentsApi.get(Number(id)),
        assessmentsApi.getSessions(Number(id)),
      ]);
      setAssessment(aRes.data.assessment);
      setSessions(sRes.data.sessions);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling for live session status updates
  useEffect(() => {
    const hasLive = sessions.some((s) => s.status === "active");
    if (!hasLive) return;
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [sessions, loadData]);

  const handleSingleInvite = async () => {
    setCreatingSingle(true);
    try {
      const res = await assessmentsApi.createSession(
        Number(id),
        candidateNameInput.trim() || undefined
      );
      const created = res.data.session;
      setSessions((prev) => [created, ...prev]);
      setShowSingleInvite(false);
      setCandidateNameInput("");
      success("Invite link generated", `Invite token created for ${created.candidate_name || "candidate"}.`);
    } catch (e: any) {
      toastError("Failed to create invite", e?.response?.data?.error || "Could not generate session.");
    } finally {
      setCreatingSingle(false);
    }
  };

  const handleBulkInvite = async () => {
    const lines = bulkNamesInput
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      toastError("Invalid input", "Please enter at least one candidate name or email.");
      return;
    }

    setCreatingBulk(true);
    try {
      const res = await sessionsApi.bulkCreate(Number(id), lines);
      setShowBulkInvite(false);
      setBulkNamesInput("");
      success(
        "Bulk invites generated",
        `Successfully generated ${res.data.sessions.length} invite links.`
      );
      loadData();
    } catch (e: any) {
      toastError("Bulk generation failed", e?.response?.data?.error || "Could not generate sessions.");
    } finally {
      setCreatingBulk(false);
    }
  };

  const handleCopyLink = (session: Session) => {
    navigator.clipboard.writeText(session.invite_url);
    setCopiedId(session.id);
    success("Copied link", "Candidate interview URL copied to clipboard.");
    setTimeout(() => setCopiedId(null), 2500);
  };

  if (loading) return <LoadingState rows={5} />;
  if (loadError || !assessment) return <ErrorState title="Assessment not found" onRetry={loadData} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={assessment.name}
        description={`${assessment.time_limit_min} min session · ${assessment.skills?.length || 0} skills assessed · Language: ${assessment.language?.toUpperCase() || "EN"}`}
        backHref="/assessments"
        backLabel="Assessments"
        actions={
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {canEdit && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/assessments/${id}/edit`)}
                  className="flex-1 sm:flex-none"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Template
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkInvite(true)}
                  className="flex-1 sm:flex-none"
                >
                  <ListPlus className="h-3.5 w-3.5 mr-1.5" /> Bulk Invite
                </Button>
              </>
            )}
            <Button size="sm" onClick={() => setShowSingleInvite(true)} className="flex-1 sm:flex-none">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Invite Candidate
            </Button>
          </div>
        }
      />

      {/* Grid: Sessions list on Left, Rubric summary on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Candidates List */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="shadow-xs overflow-hidden">
            <CardHeader className="p-4 pb-3 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span>Invited Candidates ({sessions.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {sessions.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <p className="text-xs text-muted-foreground">
                    No candidates invited yet for this assessment.
                  </p>
                  <Button size="sm" onClick={() => setShowSingleInvite(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Generate First Invite
                  </Button>
                </div>
              ) : (
                <div className="divide-y text-xs">
                  {sessions.map((s) => {
                    const isLive = s.status === "active";
                    const isEnded = s.status === "ended";
                    const isPending = s.status === "pending";

                    return (
                      <div
                        key={s.id}
                        className="p-3.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-muted/20 transition-colors gap-3"
                      >
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground truncate">
                              {s.candidate_name || `Candidate #${s.id}`}
                            </span>
                            {isLive && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary px-2 py-0.5 rounded-full bg-primary/10">
                                <Radio className="h-3 w-3 animate-ping" /> Live
                              </span>
                            )}
                            {isEnded && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10">
                                Completed
                              </span>
                            )}
                            {isPending && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/10">
                                Awaiting Candidate
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground font-mono truncate max-w-full">
                            {s.invite_url}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                          {isPending && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleCopyLink(s)}
                            >
                              {copiedId === s.id ? (
                                <>
                                  <Check className="h-3 w-3 mr-1 text-green-600" /> Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3 mr-1" /> Copy Link
                                </>
                              )}
                            </Button>
                          )}
                          {isLive && (
                            <Button
                              size="sm"
                              className="h-7 px-2.5 text-xs gap-1"
                              onClick={() =>
                                navigate(`/assessments/${id}/sessions/${s.id}/monitor`)
                              }
                            >
                              <Eye className="h-3 w-3" /> Live Monitor
                            </Button>
                          )}
                          {isEnded && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-xs"
                              onClick={() =>
                                navigate(`/assessments/${id}/sessions/${s.id}/portfolio`)
                              }
                            >
                              View Results
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Tested Skills & Rubrics */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 border-b bg-muted/20">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>Assessed Skills Rubric ({assessment.skills?.length || 0})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              {assessment.skills?.map((s, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-muted/30 border space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground text-xs">{s.skill_label}</span>
                    <span className="px-2 py-0.5 rounded bg-background border font-mono font-bold text-[10px] text-primary shrink-0">
                      L{s.expected_level} · {LEVEL_LABELS[s.expected_level]}
                    </span>
                  </div>
                  {s.scope_include && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Scope: {s.scope_include}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Single Invite Dialog */}
      <Dialog open={showSingleInvite} onOpenChange={setShowSingleInvite}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cand-name">Candidate Name</Label>
              <Input
                id="cand-name"
                placeholder="e.g. Budi Santoso"
                value={candidateNameInput}
                onChange={(e) => setCandidateNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSingleInvite()}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Optional: helps identify candidate results on the dashboard.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSingleInvite(false)}>
              Cancel
            </Button>
            <Button onClick={handleSingleInvite} disabled={creatingSingle}>
              {creatingSingle && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate Invite Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Invite Dialog */}
      <Dialog open={showBulkInvite} onOpenChange={setShowBulkInvite}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListPlus className="h-5 w-5 text-primary" />
              <span>Bulk Candidate Invite</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-names">Candidate Names (One per line)</Label>
              <Textarea
                id="bulk-names"
                rows={6}
                placeholder={"Andi Pratama\nSiti Rahma\nBudi Santoso"}
                value={bulkNamesInput}
                onChange={(e) => setBulkNamesInput(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Paste names or identifiers. A dedicated interview token will be generated for each entry.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkInvite(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkInvite} disabled={creatingBulk}>
              {creatingBulk && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate Batch Invites
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
