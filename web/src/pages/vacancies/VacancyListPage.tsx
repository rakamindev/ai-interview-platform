import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { vacanciesApi } from "@/services/vacancies";
import { Archive, Briefcase, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import type { PaginationMeta, Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [working, setWorking] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    vacanciesApi.list(page, showArchived, search)
      .then((res) => {
        if (cancelled) return;
        setVacancies(res.data.vacancies);
        setMeta(res.data.meta ?? null);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, search, showArchived]);

  const changeView = (archived: boolean) => {
    setShowArchived(archived); setPage(1); setSelectedIds([]); setSelectionMode(false);
  };
  const changeSearch = (value: string) => {
    setSearch(value); setPage(1); setSelectedIds([]);
  };
  const toggleSelected = (id: number) => setSelectedIds((current) => current.includes(id)
    ? current.filter((selectedId) => selectedId !== id) : [...current, id]);
  const allSelected = vacancies.length > 0 && vacancies.every((vacancy) => selectedIds.includes(vacancy.id));

  const updateArchiveState = async (archived: boolean) => {
    const action = archived ? "Archive" : "Restore";
    if (!selectedIds.length || !window.confirm(`${action} ${selectedIds.length} vacancy(ies)?`)) return;
    setWorking(true);
    try {
      if (archived) await vacanciesApi.bulkArchive(selectedIds);
      else await vacanciesApi.bulkUnarchive(selectedIds);
      setVacancies((current) => current.filter((vacancy) => !selectedIds.includes(vacancy.id)));
      setSelectedIds([]);
    } catch { setError(true); } finally { setWorking(false); }
  };
  const unarchiveOne = async (id: number) => {
    setWorking(true);
    try { await vacanciesApi.unarchive(id); setVacancies((current) => current.filter((vacancy) => vacancy.id !== id)); }
    catch { setError(true); } finally { setWorking(false); }
  };

  const activeCount = meta?.active_count ?? (!showArchived ? meta?.total_count : undefined);
  const archivedCount = meta?.archived_count ?? (showArchived ? meta?.total_count : undefined);
  const totalPages = meta?.total_pages ?? 1;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight">Vacancies</h1><p className="mt-1 text-sm text-muted-foreground">Define role expectations for fit/gap analysis.</p></div>
        <Button onClick={() => navigate("/vacancies/new")}><Plus className="h-4 w-4" />New vacancy</Button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input aria-label="Search vacancies" className="pl-9" placeholder="Search vacancies..." value={search} onChange={(event) => changeSearch(event.target.value)} /></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border p-1" role="group" aria-label="Vacancy status"><Button size="sm" variant={!showArchived ? "secondary" : "ghost"} aria-label="Active" aria-pressed={!showArchived} onClick={() => changeView(false)}>Active ({activeCount ?? 0})</Button><Button size="sm" variant={showArchived ? "secondary" : "ghost"} aria-label="Archived" aria-pressed={showArchived} onClick={() => changeView(true)}>Archived ({archivedCount ?? 0})</Button></div>
          {!selectionMode && <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)}>Select</Button>}
          {selectionMode && <><Button variant="outline" size="sm" onClick={() => setSelectedIds(allSelected ? [] : vacancies.map((vacancy) => vacancy.id))}>{allSelected ? "Clear all" : "Select all"}</Button>{selectedIds.length > 0 && <Button variant="outline" size="sm" onClick={() => updateArchiveState(!showArchived)} disabled={working}><Archive className="h-4 w-4" />{showArchived ? "Unarchive selected" : "Archive selected"}</Button>}<Button variant="ghost" size="sm" onClick={() => { setSelectionMode(false); setSelectedIds([]); }}>Cancel</Button></>}
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">Failed to load vacancies. Please refresh the page.</div>}
      {loading ? <div className="grid gap-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div> : vacancies.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground"><p className="mb-3">{search ? "No vacancies match your search." : showArchived ? "No archived vacancies." : "No vacancies yet."}</p>{!search && !showArchived && <Button variant="outline" onClick={() => navigate("/vacancies/new")}><Plus className="h-4 w-4" />Create your first vacancy</Button>}</div>
      ) : (
        <div className="grid gap-3">{vacancies.map((vacancy) => <Card key={vacancy.id} role={selectionMode ? "button" : "link"} tabIndex={0} aria-pressed={selectionMode ? selectedIds.includes(vacancy.id) : undefined} aria-label={selectionMode ? `Toggle selection for ${vacancy.role_title}` : `Edit vacancy ${vacancy.role_title}`} className="cursor-pointer transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => selectionMode ? toggleSelected(vacancy.id) : navigate(`/vacancies/${vacancy.id}/edit`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectionMode ? toggleSelected(vacancy.id) : navigate(`/vacancies/${vacancy.id}/edit`); } }}><CardContent className="flex min-h-20 items-center justify-between gap-4 p-4"><div className="flex min-w-0 items-center gap-3">{selectionMode && <input type="checkbox" aria-label={`Select ${vacancy.role_title}`} checked={selectedIds.includes(vacancy.id)} onChange={() => toggleSelected(vacancy.id)} onClick={(event) => event.stopPropagation()} className="h-4 w-4 rounded border-input" />}<Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /><div className="min-w-0"><p className="truncate font-medium">{vacancy.role_title}</p><p className="mt-1 text-xs text-muted-foreground">{vacancy.archived_at ? "Archived" : "Available for fit/gap analysis"}</p></div></div><div className="flex shrink-0 items-center gap-2">{showArchived && <Button variant="outline" size="sm" disabled={working} onClick={(event) => { event.stopPropagation(); unarchiveOne(vacancy.id); }}>Unarchive</Button>}<span className="text-muted-foreground" aria-hidden="true">›</span></div></CardContent></Card>)}</div>
      )}

      {!loading && totalPages > 1 && <nav className="flex items-center justify-between border-t pt-4" aria-label="Vacancy pagination"><p className="text-sm text-muted-foreground">Page {meta?.current_page ?? page} of {totalPages}</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="h-4 w-4" />Previous</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next<ChevronRight className="h-4 w-4" /></Button></div></nav>}
    </div>
  );
}
