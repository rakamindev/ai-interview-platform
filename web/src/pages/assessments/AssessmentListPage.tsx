import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight } from "lucide-react";
import type { Assessment } from "@/types";

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return <span className="text-xs text-muted-foreground">—</span>;

  if (session.status === "active")
    return (
      <span className="flex items-center gap-1.5 text-xs text-primary font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        Live now
      </span>
    );

  if (session.status === "ended" && session.end_reason === "error")
    return (
      <span className="flex items-center gap-1.5 text-xs text-destructive">
        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
        Failed
      </span>
    );

  if (session.status === "ended")
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-600">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Completed
      </span>
    );

  return (
    <span className="flex items-center gap-1.5 text-xs text-amber-600">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Awaiting candidate
    </span>
  );
}

function AssessmentCardItem({
  assessment,
  index,
  onSelect,
}: {
  assessment: Assessment;
  index: number;
  onSelect: () => void;
}) {
  return (
    <div
      className="p-4 space-y-3 cursor-pointer hover:bg-muted/40 transition-colors"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold px-2 py-0.5 bg-muted border text-muted-foreground">
            #{index}
          </span>
          <span className="text-sm font-semibold text-foreground">{assessment.name}</span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          <span>{assessment.time_limit_min} min</span>
        </div>
        <SessionSummary session={assessment.latest_session} />
      </div>
    </div>
  );
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Assessments</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track candidate interview assessments.
          </p>
        </div>
        <Button onClick={() => navigate("/assessments/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Assessment
        </Button>
      </div>

      <Separator />

      {error && (
        <div className="border border-destructive/40 p-4 text-sm text-destructive">
          Failed to load assessments. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : assessments.length === 0 ? (
        <div className="border p-12 text-center text-sm text-muted-foreground">
          <p className="mb-3">No assessments yet.</p>
          <Button variant="outline" onClick={() => navigate("/assessments/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> Create your first assessment
          </Button>
        </div>
      ) : (
        <>
          {/* Mobile & Tablet card view */}
          <Card className="lg:hidden rounded-none">
            <CardContent className="p-0 divide-y">
              {assessments.map((a, i) => (
                <AssessmentCardItem
                  key={a.id}
                  assessment={a}
                  index={i + 1}
                  onSelect={() => navigate(`/assessments/${a.id}/invite`)}
                />
              ))}
            </CardContent>
          </Card>

          {/* Desktop table view */}
          <div className="hidden lg:block bg-card overflow-hidden">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[6%] text-center">#</TableHead>
                  <TableHead className="w-[38%]">Name</TableHead>
                  <TableHead className="w-[18%]">Duration</TableHead>
                  <TableHead className="w-[22%]">Status</TableHead>
                  <TableHead className="w-[16%] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessments.map((a, i) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-center font-medium text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      {a.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {a.time_limit_min} min
                      </span>
                    </TableCell>
                    <TableCell>
                      <SessionSummary session={a.latest_session} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/assessments/${a.id}/invite`)}
                      >
                        Open →
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
