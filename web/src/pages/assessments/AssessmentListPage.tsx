import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, Search } from "lucide-react";
import type { Assessment, PaginationMeta } from "@/types";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

function SessionBadge({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return <span className="text-muted-foreground">—</span>;

  if (session.status === "active")
    return (
      <span className="flex items-center gap-1 text-xs text-primary">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        Live now
      </span>
    );

  if (session.status === "ended" && session.end_reason === "error")
    return <span className="text-xs text-destructive">Failed</span>;

  if (session.status === "ended")
    return <span className="text-xs text-muted-foreground">Completed</span>;

  return <span className="text-xs text-muted-foreground">Awaiting</span>;
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const navigate = useNavigate();

  const fetchAssessments = useCallback(() => {
    setLoading(true);
    setError(false);
    assessmentsApi
      .list(page, search || undefined)
      .then((res) => {
        setAssessments(res.data.assessments);
        setMeta(res.data.meta);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (a: Assessment) => (
        <span className="font-medium">{a.name}</span>
      ),
    },
    {
      key: "time_limit_min",
      header: "Duration",
      render: (a: Assessment) => (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          {a.time_limit_min} min
        </span>
      ),
    },
    {
      key: "latest_session",
      header: "Last Session",
      render: (a: Assessment) => <SessionBadge session={a.latest_session} />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Assessments</h1>
        <Button onClick={() => navigate("/assessments/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Assessment
        </Button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by title..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">Search</Button>
        {search && (
          <Button type="button" variant="ghost" onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}>
            Clear
          </Button>
        )}
      </form>

      {error && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive">
          Failed to load assessments. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={assessments}
            onRowClick={(a) => navigate(`/assessments/${a.id}/invite`)}
            emptyMessage={search ? "No assessments found matching your search." : "No assessments yet."}
          />
          {meta && (
            <Pagination
              currentPage={meta.current_page}
              totalPages={meta.total_pages}
              totalCount={meta.total_count}
              perPage={meta.per_page}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}