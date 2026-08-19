import { useCallback, useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import UploadDropzone from "@/components/cvScreening/UploadDropzone";
import EntryRow, { CANDIDATE_GRID_COLS } from "@/components/cvScreening/EntryRow";
import DeleteResourceDialog from "@/components/DeleteResourceDialog";
import { cvScreeningsApi } from "@/services/cvScreenings";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, ChevronLeft, ChevronRight, FileSearch2, Pencil, Users } from "lucide-react";
import type { CvScreening, CvScreeningEntry, CvScreeningBatch, PaginationMeta } from "@/types";

const DECISION_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "pending", label: "Processing" },
  { value: "needs_review", label: "Needs review" },
  { value: "invited", label: "Invited" },
  { value: "not_advanced", label: "Not advanced" },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function CvScreeningDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [screening, setScreening] = useState<CvScreening | null>(null);
  const [entries, setEntries] = useState<CvScreeningEntry[]>([]);
  const [latestBatch, setLatestBatch] = useState<CvScreeningBatch | null>(null);
  const [metaLoadedId, setMetaLoadedId] = useState<string | undefined>(undefined);
  const [entriesLoadedId, setEntriesLoadedId] = useState<string | undefined>(undefined);
  const loading = metaLoadedId !== id || entriesLoadedId !== id;
  const [error, setError] = useState(false);
  const [decisionFilter, setDecisionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [entriesMeta, setEntriesMeta] = useState<PaginationMeta | null>(null);
  const [reviewingEntryId, setReviewingEntryId] = useState<number | null>(null);
  const [reanalyzingEntryId, setReanalyzingEntryId] = useState<number | null>(null);
  const [cancellingEntryId, setCancellingEntryId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  const loadScreening = useCallback(async () => {
    const res = await cvScreeningsApi.get(Number(id));
    setScreening(res.data.cv_screening);
  }, [id]);

  const loadBatches = useCallback(async () => {
    const res = await cvScreeningsApi.batches(Number(id));
    setLatestBatch(res.data.batches[0] ?? null);
  }, [id]);

  const loadEntries = useCallback(async () => {
    const res = await cvScreeningsApi.entries(Number(id), decisionFilter || undefined, page, perPage);
    setEntries(res.data.entries);
    setEntriesMeta(res.data.meta);
    // A poll-driven refresh can shrink the result set out from under a user
    // sitting on a later page (e.g. entries moving out of the current filter)
    // — land them on the new last page instead of stranding them on an empty one.
    if (res.data.meta.total_pages >= 1 && page > res.data.meta.total_pages) {
      setPage(res.data.meta.total_pages);
    }
  }, [id, decisionFilter, page, perPage]);

  useEffect(() => {
    Promise.all([loadScreening(), loadBatches()])
      .catch(() => setError(true))
      .finally(() => setMetaLoadedId(id));
  }, [loadScreening, loadBatches, id]);

  useEffect(() => {
    loadEntries()
      .catch(() => setError(true))
      .finally(() => setEntriesLoadedId(id));
  }, [loadEntries, id]);

  const hasPendingEntries = entries.some((e) => e.decision === "pending");
  usePolling(
    async () => {
      await Promise.all([loadEntries(), loadScreening(), loadBatches()]);
    },
    5000,
    hasPendingEntries
  );

  const handleFilterChange = (value: string) => {
    setDecisionFilter(value);
    setPage(1);
  };

  const handlePerPageChange = (value: number) => {
    setPerPage(value);
    setPage(1);
  };

  const handleUpload = async (files: File[], onProgress: (percent: number) => void) => {
    await cvScreeningsApi.uploadBatch(Number(id), files, onProgress);
    await Promise.all([loadEntries(), loadScreening(), loadBatches()]);
  };

  const handleReview = async (entryId: number, action: "invite" | "reject", email?: string) => {
    setReviewingEntryId(entryId);
    try {
      await cvScreeningsApi.reviewEntry(entryId, action, email);
      await Promise.all([loadEntries(), loadScreening()]);
      setReviewingEntryId(null);
    } catch {
      setReviewingEntryId(null);
      setError(true);
    }
  };

  const handleReanalyze = async (entryId: number) => {
    setReanalyzingEntryId(entryId);
    try {
      await cvScreeningsApi.reanalyzeEntry(entryId);
      await Promise.all([loadEntries(), loadScreening()]);
      setReanalyzingEntryId(null);
    } catch {
      setReanalyzingEntryId(null);
      setError(true);
    }
  };

  const handleCancel = async (entryId: number) => {
    setCancellingEntryId(entryId);
    try {
      await cvScreeningsApi.cancelEntry(entryId);
      await Promise.all([loadEntries(), loadScreening(), loadBatches()]);
      setCancellingEntryId(null);
    } catch {
      setCancellingEntryId(null);
      setError(true);
    }
  };

  const handleConfirmBatch = async () => {
    if (!latestBatch) return;
    setConfirming(true);
    try {
      await cvScreeningsApi.confirmBatch(Number(id), latestBatch.id);
      await loadBatches();
      setConfirming(false);
    } catch {
      setConfirming(false);
      setError(true);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive">
          Failed to load this screening. Please refresh the page.
        </div>
      </div>
    );
  }

  const summary = screening?.summary;
  // The batch's own snapshotted threshold is what actually decided the candidates
  // on screen (decision_engine.rb compares against cv_screening_batch.threshold,
  // frozen at upload time) — fall back to the screening's current setting only
  // when no batch has been uploaded yet, so there's nothing snapshotted to show.
  const effectiveThreshold = latestBatch?.threshold ?? screening?.threshold;
  // Only worth flagging when the latest batch actually snapshotted its own
  // threshold and that value has since drifted from the screening's current
  // setting (e.g. via CvScreeningEditPage) — otherwise effectiveThreshold
  // already equals the current one and there's nothing to reconcile.
  const currentThreshold = screening?.threshold ?? null;
  const thresholdsDiffer = latestBatch?.threshold != null && latestBatch.threshold !== currentThreshold;

  // Global 0-indexed offset of this page's first row, so row numbers stay
  // unique and descending (newest = highest) across pages instead of
  // restarting at the page size on every page.
  const pageOffset = entriesMeta ? (entriesMeta.current_page - 1) * entriesMeta.per_page : 0;
  const totalCount = entriesMeta?.total_count ?? entries.length;
  const showingFrom = totalCount === 0 ? 0 : pageOffset + 1;
  const showingTo = totalCount === 0 ? 0 : Math.min(pageOffset + entries.length, totalCount);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/cv-screenings" className="text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold break-words">{screening?.name}</h1>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Users className="h-3 w-3" />
              {summary?.total ?? 0} candidate{summary?.total === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        {screening && (
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => navigate(`/cv-screenings/${id}/edit`)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
            <DeleteResourceDialog
              resourceLabel="CV screening"
              resourceName={screening.name}
              onConfirmDelete={() => cvScreeningsApi.delete(Number(id)).then(() => {})}
              onDeleted={() => navigate("/cv-screenings")}
            />
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground border rounded-md px-3 py-2 bg-muted/40">
        {typeof effectiveThreshold === "number" ? (
          <>
            Auto-invite threshold: <strong className="text-foreground">{effectiveThreshold}</strong>.
            A candidate is <strong className="text-foreground">auto-invited</strong> when it meets
            the public requirements and scores ≥ {effectiveThreshold},{" "}
            <strong className="text-foreground">auto-rejected</strong> when it doesn't meet the
            public requirements, and left for{" "}
            <strong className="text-foreground">manual Invite/Reject</strong> when it meets
            requirements but scores below {effectiveThreshold}.
          </>
        ) : (
          <>
            No auto-invite threshold is set. A candidate is{" "}
            <strong className="text-foreground">auto-rejected</strong> when it doesn't meet the
            public requirements; everything else is left for{" "}
            <strong className="text-foreground">manual Invite/Reject</strong> review.
          </>
        )}
        {thresholdsDiffer && (
          <div className="mt-1.5 pt-1.5 border-t border-border/60">
            This is the threshold that decided your already-uploaded candidates. Your current
            setting is <strong className="text-foreground">{currentThreshold}</strong> — it'll
            apply the next time you upload CVs to this screening.
          </div>
        )}
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Processing</div>
              <div className="text-lg font-semibold">{summary.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Needs review</div>
              <div className="text-lg font-semibold text-amber-600">{summary.needs_review}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Invited</div>
              <div className="text-lg font-semibold text-green-600">{summary.invited}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Not advanced</div>
              <div className="text-lg font-semibold">{summary.not_advanced}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {latestBatch?.vacancy_version_approximate && (
        <div className="text-xs text-muted-foreground border rounded-md px-3 py-2 bg-muted/40">
          The latest batch was scored against an <strong>approximate</strong> snapshot of the
          vacancy — reconstructed from its current state, not its actual history at upload time.
        </div>
      )}

      {latestBatch?.notification_status === "held" && (
        <div className="border border-amber-400/50 bg-amber-50 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-amber-800">
            Every candidate in the latest batch resolved the same way — review before we notify
            them.
          </p>
          <Button size="sm" onClick={handleConfirmBatch} disabled={confirming}>
            {confirming ? "Confirming…" : "Confirm & send"}
          </Button>
        </div>
      )}

      <Separator />

      {/* Upload */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Upload CVs</h2>
        <UploadDropzone onUpload={handleUpload} />
      </div>

      <Separator />

      {/* Entries */}
      <div className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold">Candidates</h2>
          <div className="flex items-center gap-1 flex-wrap bg-[#EEF0F3] p-1 rounded-[10px]">
            {DECISION_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={decisionFilter === f.value ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => handleFilterChange(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="border rounded-lg p-10 text-center space-y-3">
            <FileSearch2 className="h-8 w-8 text-muted-foreground mx-auto" />
            <div>
              <p className="text-sm font-medium">No candidates yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload CVs above to get started.
              </p>
            </div>
          </div>
        ) : (
          <Card className="overflow-x-auto">
            <CardContent className="p-0 min-w-[594px]">
              <div
                className={`grid ${CANDIDATE_GRID_COLS} items-center gap-3 py-3 px-5 border-b text-xs font-semibold uppercase tracking-wide text-[#8A8F98]`}
              >
                <div />
                <div>Candidate</div>
                <div>Status</div>
                <div>Score</div>
                <div>Actions</div>
                <div />
              </div>
              <div className="divide-y">
                {entries.map((entry, i) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    index={totalCount - (pageOffset + i)}
                    onReview={handleReview}
                    reviewing={reviewingEntryId === entry.id}
                    onReanalyze={handleReanalyze}
                    reanalyzing={reanalyzingEntryId === entry.id}
                    onCancel={handleCancel}
                    cancelling={cancellingEntryId === entry.id}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-3 border-t text-xs text-muted-foreground">
                <div>
                  Showing {showingFrom}–{showingTo} of {totalCount} candidate{totalCount === 1 ? "" : "s"}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span>Rows per page</span>
                    <Select
                      value={String(perPage)}
                      onValueChange={(value) => handlePerPageChange(Number(value))}
                    >
                      <SelectTrigger className="h-7 w-[68px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>
                      Page {entriesMeta?.current_page ?? 1} of {entriesMeta?.total_pages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={!entriesMeta || entriesMeta.current_page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={!entriesMeta || entriesMeta.current_page >= entriesMeta.total_pages}
                      onClick={() => setPage((p) => p + 1)}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
