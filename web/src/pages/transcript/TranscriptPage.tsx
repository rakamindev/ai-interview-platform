import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/shared/EmptyState";
import { sessionsApi } from "@/services/sessions";
import { ArrowLeft, Download, MessageSquare } from "lucide-react";
import type { TranscriptTurn } from "@/types";

export default function TranscriptPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
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
    load();
  }, [load]);

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
    <div className="max-w-5xl space-y-6">
      <PageHeader
        breadcrumb={
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to portfolio
          </Link>
        }
        title="Interview Transcript"
        description={candidateName ?? undefined}
        actions={
          !loading && !error && turns.length > 0 ? (
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download .txt
            </Button>
          ) : undefined
        }
      />

      {loading && <LoadingBlock rows={4} />}

      {error && (
        <ErrorState
          title="Failed to load transcript"
          description="Check your connection and try again."
          onRetry={load}
        />
      )}

      {!loading && !error && turns.length === 0 && (
        <EmptyState
          icon={MessageSquare}
          title="No transcript available"
          description="This session does not have a transcript yet."
        />
      )}

      {!loading && !error && turns.length > 0 && (
        <div className="space-y-3">
          {turns.map((turn) => {
            const isAI = turn.speaker === "ai";
            return (
              <div
                key={turn.id}
                className={`rounded-lg p-4 ${isAI
                  ? "bg-muted border"
                  : "bg-background border border-primary/20"
                  }`}
              >
                <p
                  className={`text-xs font-semibold mb-1 ${isAI ? "text-muted-foreground" : "text-primary"
                    }`}
                >
                  {isAI ? "AI Interviewer" : "Candidate"}
                </p>
                <p className="text-sm break-anywhere whitespace-pre-wrap">{turn.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
