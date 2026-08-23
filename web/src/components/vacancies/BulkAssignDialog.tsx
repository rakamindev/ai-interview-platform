import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { assessmentsApi } from "@/services/assessments";
import { Loader2, Copy, Check, Users } from "lucide-react";
import type { VacancyAssessmentSummary, VacancyCandidate, Session } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: VacancyCandidate[];
  assessments: VacancyAssessmentSummary[];
  selectedIds: Set<number>;
}

export default function BulkAssignDialog({ open, onOpenChange, candidates, assessments, selectedIds }: Props) {
  const [targetAssessmentId, setTargetAssessmentId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Session[]>([]);
  const [failed, setFailed] = useState<{ candidate_name?: string; errors: string[] }[]>([]);
  const [done, setDone] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const selected = candidates.filter((c) => selectedIds.has(c.session_id));

  const handleAssign = async () => {
    if (!targetAssessmentId) return;
    setSubmitting(true);
    try {
      const res = await assessmentsApi.bulkCreateSessions(
        targetAssessmentId,
        selected.map((c) => ({ candidate_name: c.candidate_name }))
      );
      setCreated(res.data.created);
      setFailed(res.data.failed);
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  const copyAll = () => {
    const links = created.map((s) => `${s.candidate_name ?? "Candidate"}: ${s.invite_url}`).join("\n");
    navigator.clipboard.writeText(links);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleClose = () => {
    onOpenChange(false);
    // reset after close animation
    setTimeout(() => { setDone(false); setCreated([]); setFailed([]); setTargetAssessmentId(null); }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Bulk Assign to Assessment
          </DialogTitle>
          <DialogDescription>
            {done
              ? `${created.length} session${created.length !== 1 ? "s" : ""} created`
              : `Assign ${selected.length} candidate${selected.length !== 1 ? "s" : ""} to an assessment`}
          </DialogDescription>
        </DialogHeader>

        {!done ? (
          <div className="space-y-4">
            {/* Candidate preview */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Selected candidates</Label>
              <div className="flex flex-wrap gap-1.5">
                {selected.map((c) => (
                  <Badge key={c.session_id} variant="secondary" className="text-xs">
                    {c.candidate_name ?? `Session #${c.session_id}`}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Assessment picker */}
            <div className="space-y-1.5">
              <Label>Target assessment <span className="text-destructive">*</span></Label>
              {assessments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assessments linked to this vacancy yet.</p>
              ) : (
                <ScrollArea className="h-36 border rounded-md p-2">
                  <div className="space-y-1">
                    {assessments.map((a) => (
                      <div
                        key={a.id}
                        className={`flex items-center gap-3 rounded-md px-2 py-2 cursor-pointer transition-colors ${
                          targetAssessmentId === a.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"
                        }`}
                        onClick={() => setTargetAssessmentId(a.id)}
                      >
                        <Checkbox
                          checked={targetAssessmentId === a.id}
                          onCheckedChange={() => setTargetAssessmentId(a.id)}
                          id={`assess-${a.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{a.name}</p>
                          <p className="text-xs text-muted-foreground">{a.time_limit_min} min · {a.session_count} sessions</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={handleAssign}
                disabled={!targetAssessmentId || submitting || assessments.length === 0}
              >
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Assign & Generate Links
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {created.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Invite links</Label>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={copyAll}>
                    {copiedAll ? <><Check className="h-3 w-3 mr-1" />Copied</> : <><Copy className="h-3 w-3 mr-1" />Copy all</>}
                  </Button>
                </div>
                <ScrollArea className="h-40 border rounded-md p-2">
                  <div className="space-y-2">
                    {created.map((s) => (
                      <div key={s.id} className="space-y-0.5">
                        <p className="text-xs font-medium">{s.candidate_name ?? `Session #${s.id}`}</p>
                        <p className="text-xs font-mono text-muted-foreground truncate">{s.invite_url}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {failed.length > 0 && (
              <div className="border border-destructive/30 rounded-md p-3 space-y-1">
                <p className="text-xs font-medium text-destructive">{failed.length} failed</p>
                {failed.map((f, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{f.candidate_name}: {f.errors.join(", ")}</p>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
