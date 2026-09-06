import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EvaluationNarrativeProps {
  overallNarrative?: string | null;
  cultureNarrative?: string | null;
}

export default function EvaluationNarrative({
  overallNarrative,
  cultureNarrative,
}: EvaluationNarrativeProps) {
  if (!overallNarrative && !cultureNarrative) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Evaluation Narrative</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {overallNarrative && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Overall Analysis
            </p>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {overallNarrative}
            </p>
          </div>
        )}
        {cultureNarrative && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Culture Alignment
            </p>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {cultureNarrative}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
