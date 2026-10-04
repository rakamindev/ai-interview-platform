import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Pagination from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight, Search } from "lucide-react";
import type { Assessment } from "@/types";

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return null;

  if (session.status === "active")
    return (
      <span className="flex items-center gap-1 text-xs text-primary">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        Live now
      </span>
    );

  if (session.status === "ended" && session.end_reason === "error")
    return <span className="text-xs text-destructive">Last: failed</span>;

  if (session.status === "ended")
    return <span className="text-xs text-muted-foreground">Last: completed</span>;

  return <span className="text-xs text-muted-foreground">Awaiting candidate</span>;
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError(false);

    assessmentsApi
      .list(page, search, perPage)
      .then((res) => {
        setAssessments(res.data.assessments);
        setTotalPages(res.data.meta.total_pages);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [page, search, perPage]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Assessments</h1>
        <Button onClick={() => navigate("/assessments/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Assessment
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Show</span>

          <Select
            value={String(perPage)}
            onValueChange={(value) => {
              setPerPage(Number(value));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[80px]">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
            </SelectContent>
          </Select>

          <span>data</span>
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search assessments..."
            className="pl-9"
          />
        </div>
      </div>

      {error && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive">
          Failed to load assessments. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : assessments.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground">
          <p className="mb-3">No assessments yet.</p>
          <Button variant="outline" onClick={() => navigate("/assessments/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> Create your first assessment
          </Button>
        </div>
      ) : (
    <div className="space-y-2">
      {assessments.map((a) => (
        <Card
          key={a.id}
          className="cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => navigate(`/assessments/${a.id}/invite`)}
        >
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{a.name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {a.time_limit_min} min
                </span>

                {a.latest_session && (
                  <>
                    <span>·</span>
                    <SessionSummary session={a.latest_session} />
                  </>
                )}
              </div>
            </div>

            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      ))}

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>   
      )}
    </div>
  );
}
