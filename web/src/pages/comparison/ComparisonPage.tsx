import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { assessmentsApi } from "@/services/assessments";
import type { AssessmentComparison } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Scale } from "lucide-react";

export default function ComparisonPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AssessmentComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    assessmentsApi
      .getComparison(Number(id))
      .then((res) => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Could not load the comparison. Please try again.
      </div>
    );
  }

  const candidates = data.candidates;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/assessments/${id}/invite`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Scale className="h-5 w-5 text-teal-600" /> Fair comparison
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.assessment.name} — all candidates normalized onto one rubric.
          </p>
        </div>
      </div>

      {candidates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No completed interviews yet. Run some sessions to build a comparison.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Ranked candidates</CardTitle>
            <CardDescription>
              Sorted by coverage, then average assessed level. Overrides reflect assessor adjustments.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">Candidate</th>
                  <th className="py-2 pr-4 font-medium">Coverage</th>
                  <th className="py-2 pr-4 font-medium">Avg level</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium">Overrides</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c, i) => (
                  <tr key={c.session_id} className="border-b last:border-0">
                    <td className="py-3 pr-4 text-muted-foreground">{i + 1}</td>
                    <td className="py-3 pr-4 font-medium">
                      <Link
                        to={`/assessments/${id}/sessions/${c.session_id}/portfolio`}
                        className="text-teal-700 hover:underline"
                      >
                        {c.candidate_name ?? `Candidate #${c.candidate_id ?? c.session_id}`}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      {c.coverage.percent}% ({c.coverage.assessed}/{c.coverage.total})
                    </td>
                    <td className="py-3 pr-4">{c.avg_level > 0 ? `${c.avg_level}/5` : "—"}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={c.overall_status === "ready_for_review" ? "secondary" : "outline"}>
                        {c.overall_status === "ready_for_review" ? "Ready" : "Needs review"}
                      </Badge>
                    </td>
                    <td className="py-3">{c.overridden_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}