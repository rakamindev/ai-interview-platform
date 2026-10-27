import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "@/components/layout/PageHeader";
import PageSkeleton, { PageHeaderSkeleton } from "@/components/layout/PageSkeleton";
import PageTransition from "@/components/layout/PageTransition";
import { sessionsApi } from "@/services/sessions";
import { Download } from "lucide-react";
import type { TranscriptTurn } from "@/types";
import ErrorState from "@/components/feedback/ErrorState";
import EmptyState from "@/components/feedback/EmptyState";

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

  if (loading) {
    return (
      <PageSkeleton label="transcript">
        <PageHeaderSkeleton actions={1} />
        <div className="space-y-3">
          <Skeleton className="h-20 w-3/4 rounded-lg" />
          <Skeleton className="h-24 w-3/4 ml-auto rounded-lg" />
          <Skeleton className="h-16 w-3/4 rounded-lg" />
        </div>
      </PageSkeleton>
    );
  }

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        backTo={`/assessments/${id}/sessions/${sessionId}/portfolio`}
        backLabel="Candidate Portfolio"
        title="Interview transcript"
        subtitle={candidateName ?? undefined}
      >
        {!error && turns.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download .txt
          </Button>
        )}
      </PageHeader>

      {error && (
        <ErrorState message="Could not load the transcript. Refresh the page to try again." />
      )}

      {!error && turns.length === 0 && (
        <EmptyState title="No transcript for this session" description="The candidate has not spoken yet, or the session ended before any turn was recorded." />
      )}

      {!error && turns.length > 0 && (
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
                <p
                  className={`text-xs font-semibold mb-1 ${
                    isAI ? "text-muted-foreground" : "text-primary"
                  }`}
                >
                  {isAI ? "AI Interviewer" : "Candidate"}
                </p>
                <p className="text-sm whitespace-pre-wrap">{turn.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </PageTransition>
  );
}
