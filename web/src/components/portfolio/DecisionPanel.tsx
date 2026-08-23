import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, LockKeyhole, RotateCcw, Sparkles } from "lucide-react";
import { sessionsApi } from "@/services/sessions";
import type { DecisionOutcome, PortfolioDecision } from "@/types";

interface DecisionPanelProps {
  sessionId: number;
  decision: PortfolioDecision;
  onDecisionChanged: (decision: PortfolioDecision) => void;
}

const OUTCOME_COPY: Record<DecisionOutcome, string> = {
  pass: "Pass",
  fail: "Fail",
};

function apiError(error: any) {
  return error?.response?.data?.errors?.[0]?.message ?? "Unable to save the decision. Please try again.";
}

function eventLabel(event: PortfolioDecision["history"][number]) {
  switch (event.event_type) {
    case "ai_recommended":
      return `AI recommended ${event.outcome ? OUTCOME_COPY[event.outcome] : "an outcome"}`;
    case "admin_finalized":
      return `Admin finalized ${event.outcome ? OUTCOME_COPY[event.outcome] : "the decision"}`;
    case "admin_reopened":
      return "Admin reopened the decision";
  }
}

export default function DecisionPanel({ sessionId, decision, onDecisionChanged }: DecisionPanelProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<DecisionOutcome>(decision.effective_outcome ?? "pass");
  const [note, setNote] = useState("");
  const [reopenMode, setReopenMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedOutcome(decision.effective_outcome ?? "pass");
    setNote("");
    setReopenMode(false);
    setError(null);
  }, [decision]);

  const requiresFinalizationNote =
    decision.status === "unavailable" ||
    (decision.ai_recommendation != null && selectedOutcome !== decision.ai_recommendation.outcome);

  const finalize = async () => {
    const normalizedNote = note.trim();
    if (requiresFinalizationNote && !normalizedNote) {
      setError("A finalization note is required when overriding AI or finalizing a legacy result.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await sessionsApi.finalizeDecision(sessionId, selectedOutcome, normalizedNote || undefined);
      onDecisionChanged(response.data.decision);
    } catch (requestError: any) {
      setError(apiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const reopen = async () => {
    const normalizedNote = note.trim();
    if (!normalizedNote) {
      setError("A reopen reason is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await sessionsApi.reopenDecision(sessionId, normalizedNote);
      onDecisionChanged(response.data.decision);
    } catch (requestError: any) {
      setError(apiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-4 space-y-4" aria-labelledby="decision-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="decision-heading" className="text-sm font-semibold">Overall decision</h2>
          <p className="text-xs text-muted-foreground mt-1">
            AI is advisory. An admin finalization is the effective result.
          </p>
        </div>
        {decision.status === "finalized" && (
          <span className="inline-flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
            <LockKeyhole className="h-3 w-3" /> Finalized
          </span>
        )}
      </div>

      {decision.ai_recommendation ? (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            AI recommendation: {OUTCOME_COPY[decision.ai_recommendation.outcome]}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{decision.ai_recommendation.rationale}</p>
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          AI recommendation unavailable for this legacy portfolio. A manual finalization requires a note.
        </div>
      )}

      {decision.status === "finalized" ? (
        <div className="space-y-3">
          <div className="rounded-md border border-green-200 bg-green-50 p-3">
            <div className="flex items-center gap-1.5 text-sm font-medium text-green-800">
              <CheckCircle2 className="h-4 w-4" />
              Final outcome: {OUTCOME_COPY[decision.finalization!.outcome]}
            </div>
            {decision.finalization?.note && <p className="mt-1 text-sm text-green-900">{decision.finalization.note}</p>}
          </div>

          {!reopenMode ? (
            <Button variant="outline" size="sm" onClick={() => setReopenMode(true)}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reopen decision
            </Button>
          ) : (
            <div className="rounded-md border p-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="reopen-note">Reason for reopening</Label>
                <Textarea
                  id="reopen-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  placeholder="Explain why the decision needs another review..."
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setReopenMode(false); setError(null); }}>Cancel</Button>
                <Button size="sm" onClick={reopen} disabled={saving}>Reopen for review</Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Admin final outcome</Label>
            <div className="flex gap-2" role="radiogroup" aria-label="Admin final outcome">
              {(Object.keys(OUTCOME_COPY) as DecisionOutcome[]).map((outcome) => (
                <Button
                  key={outcome}
                  type="button"
                  size="sm"
                  variant={selectedOutcome === outcome ? "default" : "outline"}
                  onClick={() => setSelectedOutcome(outcome)}
                  role="radio"
                  aria-checked={selectedOutcome === outcome}
                >
                  {OUTCOME_COPY[outcome]}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="finalization-note">
              Finalization note {requiresFinalizationNote ? "(required)" : "(optional)"}
            </Label>
            <Textarea
              id="finalization-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Record the evidence or judgment behind this decision..."
            />
          </div>
          <Button onClick={finalize} disabled={saving}>
            {saving ? "Finalizing..." : `Finalize ${OUTCOME_COPY[selectedOutcome]}`}
          </Button>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {decision.history.length > 0 && (
        <div className="border-t pt-3 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision history</h3>
          <ol className="space-y-2">
            {decision.history.map((event, index) => (
              <li key={`${event.event_type}-${event.created_at}-${index}`} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{eventLabel(event)}</span>
                <span> · {new Date(event.created_at).toLocaleString()}</span>
                {event.actor_id && <span> · Admin #{event.actor_id}</span>}
                {event.note && <span> — {event.note}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
