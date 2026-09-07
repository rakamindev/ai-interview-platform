import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionsApi } from "@/services/sessions";
import { ArrowLeft, Download, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranscriptTurn } from "@/types";

/**
 * Splits a turn around every case-insensitive occurrence of `query`, so the
 * matched runs can be marked without dangerously setting inner HTML.
 */
export function highlightParts(text: string, query: string): { text: string; match: boolean }[] {
  const needle = query.trim();
  if (!needle) return [{ text, match: false }];

  const parts: { text: string; match: boolean }[] = [];
  const haystack = text.toLowerCase();
  const lower = needle.toLowerCase();

  let cursor = 0;
  let found = haystack.indexOf(lower, cursor);

  while (found !== -1) {
    if (found > cursor) parts.push({ text: text.slice(cursor, found), match: false });
    parts.push({ text: text.slice(found, found + needle.length), match: true });
    cursor = found + needle.length;
    found = haystack.indexOf(lower, cursor);
  }

  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts;
}

export default function TranscriptPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    Promise.all([
      sessionsApi.getTranscript(Number(sessionId)),
      sessionsApi.get(Number(sessionId)),
    ])
      .then(([tRes, sRes]) => {
        setTurns(tRes.data.turns);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return null;
    return new Set(turns.filter((t) => t.text.toLowerCase().includes(needle)).map((t) => t.id));
  }, [turns, query]);

  const candidateTurns = turns.filter((t) => t.speaker === "candidate").length;

  const handleDownload = () => {
    // Turn numbers go into the file too: a quote in a portfolio is only
    // evidence if someone can find where it came from.
    const lines = turns.map((t) => {
      const label = t.speaker === "ai" ? "AI" : "Candidate";
      return `[${t.turn_number}] ${label}\n${t.text}`;
    });
    const blob = new Blob([lines.join("\n\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-session-${sessionId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Back to portfolio"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">Interview Transcript</h1>
            <p className="text-sm text-muted-foreground">
              {candidateName && <span className="break-words">{candidateName} · </span>}
              {turns.length} turns, {candidateTurns} from the candidate
            </p>
          </div>
        </div>
        {!loading && !error && turns.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Download .txt
          </Button>
        )}
      </div>

      {/*
        The portfolio presents quotes as the evidence behind a level, and until
        now there was no way to find one here — an assessor asked to defend a
        rating had to scroll and hope. Pasting the quote is the fastest route
        from "the model claims this" to "the candidate said this".
      */}
      {!loading && !error && turns.length > 0 && (
        <div className="space-y-1.5">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Paste a quote from the portfolio to find it here..."
              className="pl-9 pr-9"
              aria-label="Search the transcript"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {matches && (
            <p className="text-xs text-muted-foreground" role="status">
              {matches.size === 0
                ? "No turn contains that text."
                : `${matches.size} of ${turns.length} turns match.`}
            </p>
          )}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border p-6 text-center text-sm text-destructive">
          Failed to load transcript. Please refresh.
        </div>
      )}

      {!loading && !error && turns.length === 0 && (
        <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
          No transcript available for this session.
        </div>
      )}

      {!loading && !error && turns.length > 0 && (
        <div className="space-y-3">
          {turns.map((turn) => {
            const isAI = turn.speaker === "ai";
            const dimmed = matches !== null && !matches.has(turn.id);

            return (
              <div
                key={turn.id}
                data-testid="transcript-turn"
                className={cn(
                  "rounded-lg border p-4 transition-opacity",
                  isAI ? "bg-muted" : "border-primary/20 bg-background",
                  dimmed && "opacity-40"
                )}
              >
                <div className="mb-1 flex items-baseline gap-2">
                  <p className={cn("text-xs font-semibold", isAI ? "text-muted-foreground" : "text-primary")}>
                    {isAI ? "AI Interviewer" : "Candidate"}
                  </p>
                  {/* Turn numbers make a quote citable. Without them "the
                      candidate said X" cannot be checked against anything. */}
                  <span className="text-xs tabular-nums text-muted-foreground/70">
                    turn {turn.turn_number}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">
                  {highlightParts(turn.text, query).map((part, i) =>
                    part.match ? (
                      <mark key={i} className="rounded bg-amber-200 px-0.5">
                        {part.text}
                      </mark>
                    ) : (
                      <span key={i}>{part.text}</span>
                    )
                  )}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
