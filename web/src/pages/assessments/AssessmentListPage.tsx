import { Link } from "react-router-dom";
import { Clock, ArrowUpRight } from "lucide-react";
import ResourceList from "@/components/ui/resource-list";
import { Badge } from "@/components/ui/badge";
import { assessmentsApi } from "@/services/assessments";
import type { Assessment } from "@/types";

function status(a: Assessment) {
  const session = a.latest_session;
  if (!session) return "No interviews";
  if (String(session.status) === "failed") return "Failed";
  if (session.status === "active") return "Live now";
  if (session.status === "ended")
    return session.end_reason === "error" ? "Failed" : "Completed";
  return "Awaiting candidate";
}
const load = async (page: number) => {
  const { data } = await assessmentsApi.list(page);
  return { records: data.assessments, meta: data.meta };
};
export default function AssessmentListPage() {
  return (
    <ResourceList<Assessment>
      title="Assessments"
      singular="assessment"
      description="Manage interview assessments, invite candidates, and follow their progress."
      createHref="/assessments/new"
      load={load}
      name={(a) => a.name}
      status={status}
      statuses={[
        "No interviews",
        "Awaiting candidate",
        "Live now",
        "Completed",
        "Failed",
      ]}
      columns={[
        {
          label: "Assessment",
          render: (a) => (
            <Link
              className="block min-w-48 font-medium hover:text-primary hover:underline"
              to={`/assessments/${a.id}/invite`}
            >
              {a.name}
            </Link>
          ),
        },
        {
          label: "Duration",
          render: (a) => (
            <span className="flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {a.time_limit_min} min
            </span>
          ),
        },
        {
          label: "Latest interview",
          render: (a) => (
            <Badge
              className="whitespace-nowrap"
              variant={
                status(a) === "Live now"
                  ? "info"
                  : status(a) === "Completed"
                    ? "success"
                    : status(a) === "Failed"
                      ? "danger"
                      : "neutral"
              }
            >
              {status(a)}
            </Badge>
          ),
        },
        {
          label: "Created",
          render: (a) => (
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {a.created_at
                ? new Date(a.created_at).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </span>
          ),
        },
        {
          label: "Actions",
          render: (a) => (
            <Link
              aria-label={`View candidates for ${a.name}`}
              className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium hover:text-primary"
              to={`/assessments/${a.id}/invite`}
            >
              View candidates
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ),
        },
      ]}
    />
  );
}
