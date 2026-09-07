import { CircleSlash, MessageSquareDashed } from "lucide-react";
import type { NotAssessedSkill } from "@/types";

interface NotAssessedPanelProps {
  skills: NotAssessedSkill[];
}

const REASON_COPY = {
  not_discussed: {
    icon: CircleSlash,
    label: "Never discussed",
    hint: "The interview ended before this skill came up.",
  },
  no_rating: {
    icon: MessageSquareDashed,
    label: "No usable rating",
    hint: "It was discussed, but the AI returned nothing it could defend a level with.",
  },
} as const;

/**
 * The counterweight to the scoring fix.
 *
 * Once the generator stopped inventing an L1 for skills the interview never
 * covered, those skills disappeared from this screen entirely — correct data,
 * but an assessor could no longer tell "strong across the board" apart from
 * "half the role was never asked about". Naming the gap is the deliverable.
 */
export default function NotAssessedPanel({ skills }: NotAssessedPanelProps) {
  if (skills.length === 0) return null;

  return (
    <section aria-labelledby="not-assessed-heading" data-testid="not-assessed-panel" className="space-y-3">
      <div>
        <h2 id="not-assessed-heading" className="text-sm font-semibold">
          Not assessed ({skills.length})
        </h2>
        <p className="text-xs text-muted-foreground">
          Configured for this role, but left without a score. These are gaps in the interview,
          not gaps in the candidate — treat them as unknown, not as weak.
        </p>
      </div>

      <ul className="divide-y rounded-lg border bg-muted/30">
        {skills.map((skill) => {
          const copy = REASON_COPY[skill.reason] ?? REASON_COPY.not_discussed;
          const Icon = copy.icon;

          return (
            <li
              key={`${skill.skill_id ?? ""}-${skill.skill_label}`}
              className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium break-words">{skill.skill_label}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{copy.label}</span>
                  <span className="hidden sm:inline">— {copy.hint}</span>
                </p>
              </div>

              {typeof skill.expected_level === "number" && (
                <span className="shrink-0 self-start rounded-md border border-dashed px-2 py-0.5 text-xs text-muted-foreground">
                  Role expects L{skill.expected_level}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
