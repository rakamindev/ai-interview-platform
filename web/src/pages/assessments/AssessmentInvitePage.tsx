import { useState, useEffect } from "react";
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
import { LEVEL_LABELS } from "@/utils/constants";
import { ArrowLeft, Plus, UserRound } from "lucide-react";
import type { Assessment, Session } from "@/types";

function SessionRow({
  session,
  index,
  assessmentId,
}: {
  session: Session;
  index: number;
  assessmentId: string;
}) {
  const navigate = useNavigate();
  const displayName = session.candidate_name || `Candidate ${index}`;

  const formattedDateTime = session.started_at
    ? new Date(session.started_at).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " WIB"
    : null;

  return (
    <div className="flex items-center justify-between py-3 px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-medium text-muted-foreground">
          {index}
        </div>
        <div className="space-y-0.5">
          <div className="text-sm font-medium">{displayName}</div>
          {formattedDateTime && (
            <div className="text-xs text-muted-foreground">
              {formattedDateTime}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {session.end_reason === "error" && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-rose-600">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Failed
          </span>
        )}
        {session.end_reason === "needs_review" && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Needs Review
          </span>
        )}
        {(session.end_reason === "completed" || (!session.end_reason && session.status === "ended")) && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Completed
          </span>
        )}

        <Button
          variant="outline"
          size="sm"
          className="h-7 px-3 text-xs font-medium"
          onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/portfolio`)}
        >
          Results
        </Button>
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
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [candidateNameInput, setCandidateNameInput] = useState("");

  const loadData = async () => {
    try {
      const [aRes, sRes] = await Promise.all([
        assessmentsApi.get(Number(id)),
        assessmentsApi.getSessions(Number(id)),
      ]);
      setAssessment(aRes.data.assessment);
      setSessions(sRes.data.sessions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleAddCandidate = async () => {
    if (!candidateNameInput.trim()) return;
    try {
      await assessmentsApi.createSession(Number(id), candidateNameInput.trim());
      setCandidateNameInput("");
      setShowInviteDialog(false);
      loadData();
    } catch {
      // noop
    }
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
            <h1 className="text-lg font-semibold">{assessment?.name ?? "Assessment"}</h1>
            <p className="text-xs text-muted-foreground">
              Candidate evaluation and competency overview
            </p>
          </div>
        </div>

        <Button size="sm" onClick={() => setShowInviteDialog(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Candidate
        </Button>
      </div>

      {/* Dialog Add Candidate */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="candidate-name">Candidate Name</Label>
            <Input
              id="candidate-name"
              placeholder="e.g. Siti Rahmawati"
              value={candidateNameInput}
              onChange={(e) => setCandidateNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCandidate()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowInviteDialog(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddCandidate}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Separator />

      {/* Candidate Sessions list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Candidates ({sessions.length})
          </h2>
        </div>

        {sessions.length === 0 ? (
          <div className="border rounded-lg p-10 text-center space-y-3">
            <UserRound className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">No candidates yet.</p>
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
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Skills assessed list */}
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
