import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, CheckCircle2, PauseCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { hiringDecisionsApi, type HiringDecision } from "@/services/hiringDecisions";

const MIN_RATIONALE = 20;

const OPTIONS = [
  { value: "advance", label: "Advance", icon: CheckCircle2, tone: "border-emerald-400 bg-emerald-50 text-emerald-900" },
  { value: "hold", label: "Hold", icon: PauseCircle, tone: "border-amber-400 bg-amber-50 text-amber-900" },
  { value: "reject", label: "Reject", icon: XCircle, tone: "border-rose-400 bg-rose-50 text-rose-900" },
] as const;

/**
 * Where the interview stops being a rating and becomes something that happened
 * to a person.
 *
 * The decision is append-only, and the panel says so before it is made rather
 * than after. A rationale is required because "why was this person rejected" is
 * the question asked afterwards, and it should not have to be answered from
 * memory.
 */
export default function HiringDecisionPanel({ portfolioId }: { portfolioId: number }) {
  const [existing, setExisting] = useState<HiringDecision | null>(null);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState<string | null>(null);
  const [rationale, setRationale] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hiringDecisionsApi
      .get(portfolioId)
      .then((res) => setExisting(res.data.hiring_decision))
      .catch(() => setError("Could not load the decision for this candidate."))
      .finally(() => setLoading(false));
  }, [portfolioId]);

  const tooShort = rationale.trim().length < MIN_RATIONALE;

  const submit = async () => {
    if (!choice || tooShort) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await hiringDecisionsApi.create(portfolioId, choice, rationale.trim());
      setExisting(res.data.hiring_decision);
    } catch (e: any) {
      if (e?.response?.status === 409) {
        // Someone else decided while this tab was open. Show theirs.
        setExisting(e.response.data?.data?.hiring_decision ?? e.response.data?.hiring_decision ?? null);
        setError("Someone had already recorded a decision for this candidate.");
      } else {
        setError(e?.response?.data?.errors?.[0]?.message ?? "Could not record the decision.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (existing) {
    const option = OPTIONS.find((o) => o.value === existing.decision);
    const Icon = option?.icon ?? CheckCircle2;

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            Decision recorded
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4">
          <span
            className={cn("inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-sm font-semibold", option?.tone)}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {option?.label ?? existing.decision}
          </span>

          <p className="break-words text-sm leading-relaxed">{existing.rationale}</p>

          <p className="text-xs text-muted-foreground">
            Recorded {new Date(existing.decided_at).toLocaleString()}. This cannot be edited: the
            ratings it was based on are stored with it, so the record still means what it meant.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Record the decision</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4">
        <div className="flex flex-wrap gap-2">
          {OPTIONS.map(({ value, label, icon: Icon, tone }) => (
            <button
              key={value}
              type="button"
              onClick={() => setChoice(value)}
              aria-pressed={choice === value}
              className={cn(
                "inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm font-medium transition-colors",
                choice === value ? tone : "border-neutral-200 text-muted-foreground hover:border-neutral-300"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hiring-rationale">Why</Label>
          <Textarea
            id="hiring-rationale"
            rows={3}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="What in this portfolio led you here? Name the evidence."
          />
          <p className="text-xs text-muted-foreground">
            {/* Not a character counter for its own sake. A candidate may one day
                be shown this, and "good fit" is not something anyone can act on. */}
            Required. This is the answer to "why was this person rejected", and it should not have to
            come from memory later.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-sm text-xs leading-relaxed text-amber-700">
            Once recorded this cannot be changed. The ratings as they stand right now are saved
            alongside it.
          </p>
          <Button onClick={submit} disabled={!choice || tooShort || submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record decision
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
