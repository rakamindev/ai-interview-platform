import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionsApi } from "@/services/sessions";
import { ArrowLeft, Download, Loader2, Search, X } from "lucide-react";
import type { TranscriptTurn } from "@/types";

const TRANSCRIPT_PAGE_SIZE = 40;

export default function TranscriptPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [totalTurns, setTotalTurns] = useState(0);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(false);
  const initialLoad = useRef(true);

  const normalizedSearch = search.trim().toLowerCase();
  const displayedTurns = normalizedSearch
    ? turns.filter((turn) => turn.text.toLowerCase().includes(normalizedSearch))
    : turns;

  useEffect(() => {
    let cancelled = false;
    if (initialLoad.current) setLoading(true);
    setError(false);

    const timer = window.setTimeout(() => {
      Promise.all([
        sessionsApi.getTranscript(Number(sessionId), undefined, TRANSCRIPT_PAGE_SIZE, search.trim()),
        sessionsApi.get(Number(sessionId)),
      ])
        .then(([tRes, sRes]) => {
          if (cancelled) return;
          setTurns(tRes.data.turns);
          setTotalTurns(tRes.data.total);
          setCandidateName(sRes.data.session.candidate_name ?? null);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        })
        .finally(() => {
          if (!cancelled) {
            initialLoad.current = false;
            setLoading(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, sessionId]);

  const loadMore = async () => {
    if (loadingMore || turns.length >= totalTurns || turns.length === 0) return;

    setLoadingMore(true);
    try {
      const nextTurn = turns[turns.length - 1].turn_number + 1;
      const response = await sessionsApi.getTranscript(
        Number(sessionId),
        nextTurn,
        TRANSCRIPT_PAGE_SIZE,
        search.trim()
      );
      setTurns((current) => {
        const existingIds = new Set(current.map((turn) => turn.id));
        return [...current, ...response.data.turns.filter((turn) => !existingIds.has(turn.id))];
      });
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await sessionsApi.getTranscript(Number(sessionId));
      const lines = response.data.turns.map((t) => {
        const label = t.speaker === "ai" ? "AI" : "Candidate";
        return `[${label}]\n${t.text}`;
      });
      const blob = new Blob([lines.join("\n\n")], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transcript-session-${sessionId}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-primary">Session transcript</p>
            <h1 className="mt-1 text-xl font-semibold">Interview Transcript</h1>
            {candidateName && (
              <p className="mt-1 text-sm text-muted-foreground">Candidate: {candidateName}</p>
            )}
          </div>
        </div>
        {!loading && !error && totalTurns > 0 && (
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
            {downloading ? "Preparing..." : "Download transcript"}
          </Button>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="border rounded-lg p-6 text-center text-sm text-destructive">
          Failed to load transcript. Please refresh.
        </div>
      )}

      {!loading && !error && totalTurns === 0 && !search.trim() && (
        <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
          No transcript available for this session.
        </div>
      )}

      {!loading && !error && (turns.length > 0 || search.trim()) && (
        <>
          <div className="rounded-lg border bg-card p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search transcript text..."
                aria-label="Search transcript text"
                className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Clear transcript search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{search ? `${totalTurns} matching turn${totalTurns === 1 ? "" : "s"}` : `${totalTurns} turns`}</span>
              {search && <span>Searches the full transcript</span>}
            </div>
          </div>

          {displayedTurns.length === 0 ? (
            <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
              No transcript turns match “{search}”.
            </div>
          ) : (
            <div className="space-y-3">
              {displayedTurns.map((turn) => {
                const isAI = turn.speaker === "ai";
                return (
                  <div
                    key={turn.id}
                    className={`rounded-lg p-4 ${
                      isAI
                        ? "border bg-muted"
                        : "border border-primary/20 bg-background"
                    }`}
                  >
                    <p className={`mb-1 text-xs font-semibold ${isAI ? "text-muted-foreground" : "text-primary"}`}>
                      {isAI ? "AI Interviewer" : "Candidate"}
                    </p>
                    <p className="whitespace-pre-wrap text-sm">{turn.text}</p>
                  </div>
                );
              })}
              {turns.length < totalTurns && (
                <Button variant="outline" className="w-full" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loadingMore ? "Loading more..." : `Load more (${totalTurns - turns.length} remaining)`}
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
