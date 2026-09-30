import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Assessment } from "@/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function SessionSummary({
  session,
}: {
  session?: Assessment["latest_session"];
}) {
  if (!session) return null;

  const baseClasses =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

  if (session.status === "active")
    return (
      <span
        className={cn(baseClasses, "bg-primary text-on-primary animate-pulse")}
      >
        Live now
      </span>
    );

  if (session.status === "ended" && session.end_reason === "error")
    return (
      <span className={cn(baseClasses, "bg-accent-tomato text-on-dark")}>
        Failed
      </span>
    );

  if (session.status === "ended")
    return (
      <span className={cn(baseClasses, "bg-canvas-soft text-ink")}>
        Completed
      </span>
    );

  return (
    <span className={cn(baseClasses, "bg-canvas-soft text-ink")}>Awaiting</span>
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
      .then((res) => {
        console.log("Assessments API response:", res.data.assessments);
        setAssessments(res.data.assessments);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      {error && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive mb-4">
          Failed to load assessments. Please refresh the page.
        </div>
      )}

      <div className="bg-canvas rounded-lg shadow-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-heading-md font-semibold text-ink">
            Latest Assessments
          </h1>
          <Button onClick={() => navigate("/assessments/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> New Assessment
          </Button>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[3fr_1fr_2fr_0.5fr] gap-4 p-2 mb-2 bg-canvas-soft rounded-md text-ink-mute-2 text-sm font-semibold uppercase tracking-wider">
          <div>ASSESSMENT</div>
          <div>DURATION</div>
          <div>STATUS</div>
          <div>ACTION</div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : assessments.length === 0 ? (
          <div className="border border-hairline-strong rounded-lg p-12 text-center text-body-md text-ink-mute">
            <p className="mb-3">No assessments yet.</p>
            <Button
              variant="outline"
              onClick={() => navigate("/assessments/new")}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Create your first assessment
            </Button>
          </div>
        ) : (
          <div className="space-y-2 bg-canvas">
            {assessments.map((a, index) => (
              <div
                key={a.id}
                className={cn(
                  "py-3 px-4 grid grid-cols-[3fr_1fr_2fr_0.5fr] items-center gap-4",
                  "hover:bg-canvas-soft transition-colors",
                  index < assessments.length - 1
                    ? "border-b border-hairline"
                    : "",
                )}
              >
                <div>
                  <p className="font-medium text-body-md text-ink">{a.name}</p>
                  <div className="flex items-center gap-2 text-caption text-ink-mute mt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {a.time_limit_min} min
                    </span>
                  </div>
                </div>
                <div className="text-body-md text-ink-secondary">
                  {a.time_limit_min} min
                </div>
                <div>
                  {a.latest_session && (
                    <SessionSummary session={a.latest_session} />
                  )}
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row click
                          navigate(`/assessments/${a.id}/invite`);
                        }}
                      >
                        <Eye className="h-4 w-4 text-ink-mute" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View Detail</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
