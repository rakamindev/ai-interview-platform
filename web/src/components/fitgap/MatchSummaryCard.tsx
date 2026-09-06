import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface MatchSummaryCardProps {
  matchPercentage: number;
  matchCount: number;
  exceedCount: number;
  gapCount: number;
  totalSkills: number;
}

export default function MatchSummaryCard({
  matchPercentage,
  matchCount,
  exceedCount,
  gapCount,
  totalSkills,
}: MatchSummaryCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">Role Match Summary</CardTitle>
            <CardDescription className="text-xs">
              Overall alignment between demonstrated candidate skills and vacancy criteria.
            </CardDescription>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold">{matchPercentage}%</span>
            <span className="text-xs text-muted-foreground block">Match Score</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${matchPercentage}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{matchCount} matched</span>
          <span>{exceedCount} exceed</span>
          <span>{gapCount} gaps</span>
          <span>{totalSkills} total skills</span>
        </div>
      </CardContent>
    </Card>
  );
}
