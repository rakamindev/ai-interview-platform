import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { CircleSlash, Pencil } from "lucide-react";
import { RATING_STATUS_EXPLANATIONS, RATING_STATUS_LABELS } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  /** Transcript page path; evidence quotes link to their turn on it. */
  transcriptPath: string;
  onOverrideSaved: (override: AssessorOverride) => void;
}

const SUMMARY_PREVIEW_CHARS = 280;

export default function SkillPortfolioCard({ skill, override, transcriptPath, onOverrideSaved }: SkillPortfolioCardProps) {
  const [editing, setEditing] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const rated = skill.rating_status === "rated" && skill.ai_level != null;
  const effectiveLevel = override?.override_level ?? skill.ai_level;
  const longSummary = skill.competency_summary.length > SUMMARY_PREVIEW_CHARS;
  const headingId = `skill-${skill.id}-label`;

  return (
    <Card aria-labelledby={headingId} className="shadow-none">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start gap-3">
          {effectiveLevel != null ? (
            <LevelBadge level={effectiveLevel} />
          ) : (
            <div className="inline-flex min-w-14 flex-col items-center justify-center rounded border border-dashed border-slate-300 px-3 py-2 text-slate-600">
              <CircleSlash aria-hidden className="h-4 w-4" />
              <span className="text-[10px]">No level</span>
            </div>
          )}

          {/* min width makes the action button wrap onto its own row on phones */}
          <div className="min-w-[12rem] flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 id={headingId} className="break-words font-semibold">
                {skill.skill_label}
              </h3>
              {skill.is_discovered && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                  Came up unprompted
                </span>
              )}
            </div>

            {rated && skill.ai_confidence ? (
              <ConfidenceIndicator
                confidence={skill.ai_confidence}
                probeCount={skill.probe_count}
                coverageState={skill.coverage_state}
              />
            ) : (
              <p className="text-xs font-medium text-slate-700">
                {RATING_STATUS_LABELS[skill.rating_status] ?? "Not rated"}
              </p>
            )}
          </div>

          {rated && !editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="w-full shrink-0 sm:w-auto">
              {override ? (
                <>
                  <Pencil aria-hidden className="mr-1 h-3 w-3" /> Edit override
                </>
              ) : (
                "Override rating"
              )}
            </Button>
          )}
        </div>

        {!rated && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <p>{RATING_STATUS_EXPLANATIONS[skill.rating_status]}</p>
            <p className="mt-1">
              It is <strong className="font-semibold">not counted for or against</strong> the candidate. If this skill
              matters for the role, assess it in a follow-up interview.
            </p>
          </div>
        )}

        {override && !editing && (
          <div className="rounded-md bg-muted/60 px-3 py-2 text-sm">
            <p className="font-medium">
              Assessor changed {skill.ai_level != null ? `L${skill.ai_level}` : "the rating"} to L{override.override_level}
            </p>
            {override.assessor_notes && (
              <p className="mt-0.5 whitespace-pre-wrap break-words text-muted-foreground">{override.assessor_notes}</p>
            )}
          </div>
        )}

        {editing && (
          <OverridePanel
            skill={skill}
            existingOverride={override}
            onCancel={() => setEditing(false)}
            onSaved={(saved) => {
              onOverrideSaved(saved);
              setEditing(false);
            }}
          />
        )}

        {rated && skill.ai_confidence === "low" && !override && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Only briefly explored. Read the evidence before relying on this level.
          </p>
        )}

        {skill.evidence.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground">What the candidate said</h4>
            <ul className="space-y-2">
              {skill.evidence.map((item, i) => (
                <li key={i} className="border-l-2 border-primary/40 pl-3 text-sm">
                  <q className="break-words">{item.quote}</q>
                  {item.turn_number != null && (
                    <Link
                      to={`${transcriptPath}#turn-${item.turn_number}`}
                      className="ml-2 whitespace-nowrap text-xs text-primary underline-offset-2 hover:underline"
                    >
                      Turn {item.turn_number}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {rated && skill.competency_summary && (
          <section className="space-y-1">
            <h4 className="text-xs font-medium text-muted-foreground">Summary</h4>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
              {longSummary && !summaryOpen
                ? `${skill.competency_summary.slice(0, SUMMARY_PREVIEW_CHARS).trimEnd()}…`
                : skill.competency_summary}
            </p>
            {longSummary && (
              <button
                type="button"
                className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                aria-expanded={summaryOpen}
                onClick={() => setSummaryOpen((open) => !open)}
              >
                {summaryOpen ? "Show less" : "Show more"}
              </button>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  );
}
