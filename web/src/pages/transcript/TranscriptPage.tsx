import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionsApi } from "@/services/sessions";
import { ArrowLeft, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranscriptTurn } from "@/types";

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function TranscriptPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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

  const handleDownload = () => {
    const lines = turns.map((t) => {
      const label = t.speaker === "ai" ? "AI Interviewer" : "Candidate";
      const ts = t.created_at ? `[${formatTime(t.created_at)}] ` : "";
      return `${ts}[${label}]\n${t.text}`;
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
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Interview Transcript</h1>
            {candidateName && (
              <p className="text-sm text-muted-foreground">{candidateName}</p>
            )}
          </div>
        </div>
        {!loading && !error && turns.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {turns.length} turn{turns.length !== 1 ? "s" : ""}
            </span>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download .txt
            </Button>
          </div>
        )}
      </div>

      {/* Skeleton */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="border rounded-lg p-6 text-center text-sm text-destructive">
          Failed to load transcript. Please refresh.
        </div>
      )}

      {/* Empty */}
      {!loading && !error && turns.length === 0 && (
        <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
          No transcript available for this session.
        </div>
      )}

      {/* Turns */}
      {!loading && !error && turns.length > 0 && (
        <div className="space-y-2">
          {turns.map((turn) => {
            const isAI = turn.speaker === "ai";
            return (
              <div key={turn.id} className="group">
                {/* Speaker label + turn number + timestamp */}
                <div
                  className={cn(
                    "flex items-center gap-2 mb-1 px-1",
                    isAI ? "justify-start" : "justify-end"
                  )}
                >
                  {!isAI && turn.created_at && (
                    <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                      {formatTime(turn.created_at)}
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-wide",
                      isAI ? "text-muted-foreground" : "text-primary"
                    )}
                  >
                    {isAI ? "AI Interviewer" : "Candidate"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    #{turn.turn_number}
                  </span>
                  {isAI && turn.created_at && (
                    <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                      {formatTime(turn.created_at)}
                    </span>
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={cn(
                    "rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                    isAI
                      ? "bg-muted border border-border/60 rounded-tl-sm"
                      : "bg-primary/5 border border-primary/20 rounded-tr-sm ml-8"
                  )}
                >
                  {turn.text}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
