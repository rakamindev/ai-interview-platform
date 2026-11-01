import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "@/components/LoadError";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/layout/PageHeader";
import { sessionsApi } from "@/services/sessions";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import { Download, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranscriptTurn } from "@/types";

export default function TranscriptPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTranscript = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([sessionsApi.getTranscript(Number(sessionId)), sessionsApi.get(Number(sessionId))])
      .then(([tRes, sRes]) => {
        setTurns(tRes.data.turns);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch((requestError: unknown) =>
        setError(
          getApiErrorStatus(requestError) === 404
            ? "This session doesn't exist or was deleted."
            : getApiErrorMessage(requestError, "Failed to load the transcript."),
        ),
      )
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
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        backTo={`/assessments/${id}/sessions/${sessionId}/portfolio`}
        backLabel="Back to portfolio"
        eyebrow="Assessment result"
        title="Interview Transcript"
        description={candidateName}
        actions={
          !loading &&
          !error &&
          turns.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download />
              Download .txt
            </Button>
          )
        }
      />

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {!loading && error && <LoadError message={error} onRetry={loadTranscript} />}

      {!loading && !error && turns.length === 0 && (
        <EmptyState icon={MessageSquare} title="No transcript available for this session." />
      )}

      {!loading && !error && turns.length > 0 && (
        <ol className="space-y-3">
          {turns.map((turn) => {
            const isAI = turn.speaker === "ai";
            return (
              <li
                key={turn.id}
                className={cn(
                  "rounded-2xl border p-4",
                  isAI ? "bg-card" : "border-rakamin-teal/30 bg-rakamin-light-cyan/50",
                )}
              >
                <p
                  className={cn(
                    "mb-1.5 text-xs font-semibold uppercase tracking-[0.14em]",
                    isAI ? "text-muted-foreground" : "text-rakamin-teal",
                  )}
                >
                  {isAI ? "AI Interviewer" : "Candidate"}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{turn.text}</p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
