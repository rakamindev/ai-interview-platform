import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import UploadDropzone from "@/components/cvScreening/UploadDropzone";
import EntryRow from "@/components/cvScreening/EntryRow";
import { cvScreeningsApi } from "@/services/cvScreenings";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, FileSearch2, Users } from "lucide-react";
import type { CvScreening, CvScreeningEntry, CvScreeningBatch } from "@/types";

const DECISION_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "pending", label: "Processing" },
  { value: "needs_review", label: "Needs review" },
  { value: "invited", label: "Invited" },
  { value: "not_advanced", label: "Not advanced" },
];

export default function CvScreeningDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [screening, setScreening] = useState<CvScreening | null>(null);
  const [entries, setEntries] = useState<CvScreeningEntry[]>([]);
  const [latestBatch, setLatestBatch] = useState<CvScreeningBatch | null>(null);
  const [metaLoadedId, setMetaLoadedId] = useState<string | undefined>(undefined);
  const [entriesLoadedId, setEntriesLoadedId] = useState<string | undefined>(undefined);
  const loading = metaLoadedId !== id || entriesLoadedId !== id;
  const [error, setError] = useState(false);
  const [decisionFilter, setDecisionFilter] = useState("");
  const [reviewingEntryId, setReviewingEntryId] = useState<number | null>(null);
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
    const res = await cvScreeningsApi.entries(Number(id), decisionFilter || undefined);
    setEntries(res.data.entries);
  }, [id, decisionFilter]);

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

  const handleUpload = async (files: File[], onProgress: (percent: number) => void) => {
    await cvScreeningsApi.uploadBatch(Number(id), files, onProgress);
    await Promise.all([loadEntries(), loadScreening(), loadBatches()]);
  };

  const handleReview = async (entryId: number, action: "invite" | "reject") => {
    setReviewingEntryId(entryId);
    try {
      await cvScreeningsApi.reviewEntry(entryId, action);
      await Promise.all([loadEntries(), loadScreening()]);
      setReviewingEntryId(null);
    } catch {
      setReviewingEntryId(null);
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-1 flex-wrap">
            {DECISION_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={decisionFilter === f.value ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setDecisionFilter(f.value)}
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
          <Card>
            <CardContent className="p-0 divide-y">
              {entries.map((entry, i) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  index={entries.length - i}
                  onReview={handleReview}
                  reviewing={reviewingEntryId === entry.id}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
