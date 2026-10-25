import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import { Archive, ChevronLeft, ChevronRight, Clock, Plus, Search } from "lucide-react";
import type { Assessment, PaginationMeta } from "@/types";

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return null;
  if (session.status === "active") return <span className="flex items-center gap-1 text-xs text-primary"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />Live now</span>;
  if (session.status === "ended" && session.end_reason === "error") return <span className="text-xs text-destructive">Last: failed</span>;
  if (session.status === "ended") return <span className="text-xs text-muted-foreground">Last: completed</span>;
  return <span className="text-xs text-muted-foreground">Awaiting candidate</span>;
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [archiving, setArchiving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    const load = async () => {
      try {
        const current = await assessmentsApi.list(page, showArchived, search.trim());
        let nextMeta = current.data.meta ?? null;

        // Older API instances may not return both status totals yet. Fetch the
        // other status once so both tab counts are still accurate on first load.
        if (nextMeta && (nextMeta.active_count === undefined || nextMeta.archived_count === undefined)) {
          const other = await assessmentsApi.list(1, !showArchived, search.trim());
          nextMeta = {
            ...nextMeta,
            active_count: showArchived ? other.data.meta.total_count : nextMeta.total_count,
            archived_count: showArchived ? nextMeta.total_count : other.data.meta.total_count,
          };
        }

        if (!cancelled) {
          setAssessments(current.data.assessments);
          setMeta(nextMeta);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [page, search, showArchived]);

  const changeView = (archived: boolean) => {
    setShowArchived(archived);
    setPage(1);
    setSelectedIds([]);
    setSelectionMode(false);
  };

  const changeSearch = (value: string) => {
    setSearch(value);
    setPage(1);
    setSelectedIds([]);
  };

  const updateSelectedArchiveState = async (archived: boolean) => {
    const action = archived ? "Archive" : "Restore";
    if (!selectedIds.length || !window.confirm(`${action} ${selectedIds.length} assessment(s)?`)) return;
    setArchiving(true);
    try {
      if (archived) await assessmentsApi.bulkArchive(selectedIds);
      else await assessmentsApi.bulkUnarchive(selectedIds);
      setAssessments((current) => current.filter((assessment) => !selectedIds.includes(assessment.id)));
      setSelectedIds([]);
    } catch { setError(true); } finally { setArchiving(false); }
  };

  const unarchiveOne = async (id: number) => {
    setArchiving(true);
    try {
      await assessmentsApi.unarchive(id);
      setAssessments((current) => current.filter((assessment) => assessment.id !== id));
    } catch { setError(true); } finally { setArchiving(false); }
  };

  const activeCount = meta?.active_count ?? (!showArchived ? meta?.total_count : undefined);
  const archivedCount = meta?.archived_count ?? (showArchived ? meta?.total_count : undefined);
  const totalPages = meta?.total_pages ?? 1;
  const allSelected = assessments.length > 0 && assessments.every((assessment) => selectedIds.includes(assessment.id));
  const openAssessment = (id: number) => navigate(`/assessments/${id}/invite`);
  const toggleSelected = (id: number) => setSelectedIds((current) => current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assessments</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create and manage your interview assessments.</p>
        </div>
        <Button onClick={() => navigate("/assessments/new")}><Plus className="h-4 w-4" />New assessment</Button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input aria-label="Search assessments" className="pl-9" placeholder="Search assessments..." value={search} onChange={(event) => changeSearch(event.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border p-1" role="group" aria-label="Assessment status">
            <Button size="sm" variant={!showArchived ? "secondary" : "ghost"} aria-label="Active" aria-pressed={!showArchived} onClick={() => changeView(false)}>Active ({activeCount ?? 0})</Button>
            <Button size="sm" variant={showArchived ? "secondary" : "ghost"} aria-label="Archived" aria-pressed={showArchived} onClick={() => changeView(true)}>Archived ({archivedCount ?? 0})</Button>
          </div>
          {!selectionMode && <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)}>Select</Button>}
          {selectionMode && <>
            <Button variant="outline" size="sm" onClick={() => setSelectedIds(allSelected ? [] : assessments.map((assessment) => assessment.id))}>{allSelected ? "Clear all" : "Select all"}</Button>
            {selectedIds.length > 0 && <Button variant="outline" size="sm" onClick={() => updateSelectedArchiveState(!showArchived)} disabled={archiving}><Archive className="h-4 w-4" />{showArchived ? "Unarchive selected" : "Archive selected"}</Button>}
            <Button variant="ghost" size="sm" onClick={() => { setSelectionMode(false); setSelectedIds([]); }}>Cancel</Button>
          </>}
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">Failed to load assessments. Please refresh the page.</div>}
      {loading ? <div className="grid gap-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full" />)}</div> : assessments.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          <p className="mb-3">{search ? "No assessments match your search." : showArchived ? "No archived assessments." : "No assessments yet."}</p>
          {!search && !showArchived && <Button variant="outline" onClick={() => navigate("/assessments/new")}><Plus className="h-4 w-4" />Create your first assessment</Button>}
        </div>
      ) : (
        <div className="grid gap-3">
          {assessments.map((assessment) => <Card key={assessment.id} role={selectionMode ? "button" : "link"} aria-pressed={selectionMode ? selectedIds.includes(assessment.id) : undefined} tabIndex={0} aria-label={selectionMode ? `Toggle selection for ${assessment.name}` : `Open assessment ${assessment.name}`} className="cursor-pointer transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => selectionMode ? toggleSelected(assessment.id) : openAssessment(assessment.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectionMode ? toggleSelected(assessment.id) : openAssessment(assessment.id); } }}>
            <CardContent className="flex min-h-28 items-center justify-between gap-4 p-4">
              <div className="flex min-w-0 items-start gap-3">
                {selectionMode && <input type="checkbox" aria-label={`Select ${assessment.name}`} checked={selectedIds.includes(assessment.id)} onChange={() => toggleSelected(assessment.id)} onClick={(event) => event.stopPropagation()} className="mt-1 h-4 w-4 rounded border-input" />}
                <div className="min-w-0"><p className="truncate font-medium">{assessment.name}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden="true" />{assessment.time_limit_min} min</span>{assessment.latest_session && <><span aria-hidden="true">·</span><SessionSummary session={assessment.latest_session} /></>}</div></div>
              </div>
              <div className="flex shrink-0 items-center gap-2">{showArchived && <Button variant="outline" size="sm" disabled={archiving} onClick={(event) => { event.stopPropagation(); unarchiveOne(assessment.id); }}>Unarchive</Button>}<span className="text-muted-foreground" aria-hidden="true">›</span></div>
            </CardContent>
          </Card>)}
        </div>
      )}

      {!loading && totalPages > 1 && <nav className="flex items-center justify-between border-t pt-4" aria-label="Assessment pagination"><p className="text-sm text-muted-foreground">Page {meta?.current_page ?? page} of {totalPages}</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="h-4 w-4" />Previous</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next<ChevronRight className="h-4 w-4" /></Button></div></nav>}
    </div>
  );
}
