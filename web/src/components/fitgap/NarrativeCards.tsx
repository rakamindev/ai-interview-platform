import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FitGapReport } from "@/types";

type NarrativeCardsProps = Pick<
  FitGapReport,
  "culture_narrative" | "overall_narrative" | "narrative_source"
>;

export default function NarrativeCards({
  culture_narrative,
  overall_narrative,
  narrative_source,
}: NarrativeCardsProps) {
  return (
    <>
      {culture_narrative && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-3 text-sm">
              <span>Culture &amp; Competency Fit</span>
              <span className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                AI-generated
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {culture_narrative}
            </p>
          </CardContent>
        </Card>
      )}

      {overall_narrative && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-3 text-sm">
              <span>Overall Assessment</span>
              <span className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                {narrative_source === "ai" ? "AI-generated" : "Rule-based fallback"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {narrative_source === "rule_based_fallback" && (
              <p className="mb-3 rounded-md border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-warning">
                The AI narrative was unavailable. This summary only counts deterministic skill-level comparisons.
              </p>
            )}
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {overall_narrative}
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
