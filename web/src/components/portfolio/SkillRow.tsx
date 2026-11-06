import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import DecisionEditor from "@/components/portfolio/DecisionEditor";
import { DEFAULT_LEVEL_MEANING, NOT_RATED_TEXT, evidenceCounts } from "@/lib/portfolioReview";
import { cn } from "@/lib/utils";
import type { AssessorOverride, EvidenceCheck, PortfolioSkill } from "@/types";

interface Props {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  levelMeaning?: (level: number) => string | undefined; // assessment's own anchor text
  roleExpectation?: number | null;
  transcriptHref: string;
  saving: boolean;
  error?: string | null;
  onSaveDecision: (skill: PortfolioSkill, level: number, notes: string) => void;
}

const CONFIDENCE_TEXT: Record<string, string> = {
  high: "High: this skill was probed at least 3 times and fully covered.",
  medium: "Medium: this skill was probed twice, or only partly covered.",
  low: "Low: this skill was only briefly discussed.",
};

function Excerpt({ check, transcriptHref }: { check: EvidenceCheck; transcriptHref: string }) {
  if (check.status === "not_found") {
    return (
      <li className="text-sm text-amber-700 dark:text-amber-400">
        An excerpt cited by the AI wasn't found in the transcript. Don't treat it as candidate evidence.
      </li>
    );
  }
  const turn = check.status === "transcript_match" ? check.turn_numbers?.[0] : check.suggested_turn;
  return (
    <li className="space-y-0.5">
      <p className="text-sm">
        {check.status === "no_exact_match" && <span className="text-muted-foreground">AI-proposed excerpt: </span>}
        “{check.quote}”
      </p>
      <p className={cn("text-xs", check.status === "transcript_match" ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400")}>
        {check.status === "transcript_match" ? "Found in transcript" : "Not an exact match, check the source"}
        {turn != null && (
          <>
            {" · "}
            <Link to={`${transcriptHref}#turn-${turn}`} className="underline underline-offset-2 hover:text-foreground">
              turn {turn}
            </Link>
          </>
        )}
      </p>
    </li>
  );
}

/**
 * One assessed skill as a calm row. Closed: AI suggestion + human decision. Open: why to believe it
 * (meaning, excerpts with provenance, confidence explained, decision history, change level).
 */
export default function SkillRow({ skill, override, levelMeaning, roleExpectation, transcriptHref, saving, error, onSaveDecision }: Props) {
  const flagged = !!override?.needs_review && override.review_reason === "ai_level_changed";
  const [open, setOpen] = useState(flagged);
  const [editing, setEditing] = useState(false);

  const meaning = skill.ai_level ? levelMeaning?.(skill.ai_level) || DEFAULT_LEVEL_MEANING[skill.ai_level] : undefined;
  const checks = skill.evidence_checks ?? [];
  const counts = evidenceCounts(checks);
  const needsLook = counts.notFound + counts.notExact > 0 || flagged;

  return (
    <section id={`skill-${skill.id}`} className="border-t py-4 scroll-mt-20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-medium leading-snug">
              {skill.skill_label}
              {needsLook && <span aria-label="needs a look" className="ml-2 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" />}
            </h3>
            <p className="mt-1 text-sm">
              {skill.ai_level ? (
                <>
                  <span className="text-lg font-semibold mr-1.5">L{skill.ai_level}</span>
                  <span className="text-muted-foreground">AI suggested</span>
                </>
              ) : (
                <span className="text-muted-foreground">Not rated · {NOT_RATED_TEXT[skill.ai_level_reason ?? "missing_level"]}</span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-sm">
            {override ? (
              <span>
                Your decision <span className="font-semibold">L{override.override_level}</span>
                {flagged && <span className="block text-xs text-amber-700 dark:text-amber-400 text-right">review</span>}
              </span>
            ) : null}
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          </div>
        </div>
        {meaning && <p className="mt-1 text-sm text-muted-foreground">{meaning}</p>}
      </button>

      {open && (
        <div className="mt-3 space-y-4 rounded-lg bg-muted/40 p-4">
          {flagged && override && !editing && (
            <div className="space-y-2">
              <p className="text-sm">
                You set <b>L{override.override_level}</b> when the AI suggested{" "}
                <b>{override.ai_level ? `L${override.ai_level}` : "no rating"}</b>. It now suggests{" "}
                <b>{skill.ai_level ? `L${skill.ai_level}` : "no rating"}</b>.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={saving} onClick={() => onSaveDecision(skill, override.override_level, override.assessor_notes)}>
                  Keep L{override.override_level}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Change level</Button>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What the candidate said</p>
            {checks.length ? (
              <ul className="mt-2 space-y-3">{checks.map((c, i) => <Excerpt key={i} check={c} transcriptHref={transcriptHref} />)}</ul>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">No excerpts for this skill.</p>
            )}
          </div>

          {skill.ai_level && (
            <p className="text-xs text-muted-foreground">
              Confidence {CONFIDENCE_TEXT[skill.ai_confidence]} This describes how much was discussed, not whether the level is right.
            </p>
          )}
          {roleExpectation != null && <p className="text-xs text-muted-foreground">Role expectation: L{roleExpectation}</p>}

          {editing ? (
            <DecisionEditor
              initialLevel={override?.override_level ?? skill.ai_level}
              initialNotes={override?.assessor_notes}
              saving={saving}
              error={error}
              onCancel={() => setEditing(false)}
              onSave={(level, notes) => {
                onSaveDecision(skill, level, notes);
                setEditing(false);
              }}
            />
          ) : (
            !flagged && (
              <div className="text-sm">
                {override && (
                  <p className="mb-1 text-muted-foreground">
                    Your decision L{override.override_level}
                    {override.assessor_notes ? ` · “${override.assessor_notes}”` : ""}
                    {override.overridden_at ? ` · ${new Date(override.overridden_at).toLocaleString()}` : ""}
                  </p>
                )}
                <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => setEditing(true)}>
                  {override ? "Change your decision" : skill.ai_level ? "Set your own level" : "Set level"}
                </button>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}
