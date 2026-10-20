import { useEffect, useState, useCallback } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionsApi } from "@/services/sessions";
import { ArrowLeft, Download } from "lucide-react";
import { formatTime } from "@/utils/dateTime";
import type { TranscriptTurn } from "@/types";

export default function TranscriptPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadTranscript = useCallback(() => {
    setLoading(true);
    setError(false);
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

  useEffect(() => {
    loadTranscript();
  }, [loadTranscript]);

  const handleDownload = () => {
    const lines = turns.map((t) => {
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
  };

  return (
    <div className="max-w-7xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" asChild>
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
              title="Back to Portfolio"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Interview Transcript</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {candidateName && <span>{candidateName}</span>}
              {candidateName && " — "}
              Complete conversational turn history and speech timestamps.
            </p>
          </div>
        </div>
        {!loading && !error && turns.length > 0 && (
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-1.5" />
            Download .txt
          </Button>
        )}
      </div>

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`rounded-lg p-4 space-y-2 border ${
                i % 2 === 1 ? "bg-muted/40" : "bg-background ml-8"
              }`}
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <ErrorState
          title="Failed to load transcript"
          description="Could not load conversational transcript turns and timestamps for this session."
          onRetry={loadTranscript}
        />
      )}

      {!loading && !error && turns.length === 0 && (
        <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
          No transcript available for this session.
        </div>
      )}

      {!loading && !error && turns.length > 0 && (
        <div className="space-y-3">
          {turns.map((turn) => {
            const isAI = turn.speaker === "ai";
            return (
              <div
                key={turn.id}
                className={`rounded-lg p-4 ${
                  isAI
                    ? "bg-muted border"
                    : "bg-background border border-primary/20"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p
                    className={`text-xs font-semibold ${
                      isAI ? "text-muted-foreground" : "text-primary"
                    }`}
                  >
                    {isAI ? "AI Interviewer" : "Candidate"}
                  </p>
                  {turn.created_at && (
                    <span className="text-[11px] text-muted-foreground" data-testid="turn-timestamp">
                      {formatTime(turn.created_at, undefined, true)}
                    </span>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{turn.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
