import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionsApi } from "@/services/sessions";
import { ArrowLeft, Download } from "lucide-react";
import type { TranscriptTurn } from "@/types";
import { sessionKeys } from "@/lib/queryKeys";

export default function TranscriptPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const numericSessionId = Number(sessionId);
  const [searchParams] = useSearchParams();
  const targetTurn = Number(searchParams.get("turn"));
  const [targetMissing, setTargetMissing] = useState(false);
  const turnRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const transcriptQuery = useQuery({
    queryKey: sessionKeys.transcript(numericSessionId),
    queryFn: async () => (await sessionsApi.getTranscript(numericSessionId)).data.turns,
  });
  const sessionQuery = useQuery({
    queryKey: sessionKeys.detail(numericSessionId),
    queryFn: async () => (await sessionsApi.get(numericSessionId)).data,
  });
  const turns: TranscriptTurn[] = transcriptQuery.data ?? [];
  const candidateName = sessionQuery.data?.session.candidate_name ?? null;
  const loading = transcriptQuery.isPending || sessionQuery.isPending;
  const error = transcriptQuery.isError || sessionQuery.isError;

  useEffect(() => {
    if (loading || error || !searchParams.has("turn")) return;

    if (!Number.isInteger(targetTurn) || targetTurn <= 0) {
      setTargetMissing(true);
      return;
    }

    const target = turns.find((turn) => turn.turn_number === targetTurn);
    if (!target) {
      setTargetMissing(true);
      return;
    }

    setTargetMissing(false);
    const element = turnRefs.current[target.id];
    element?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    element?.focus();
  }, [error, loading, searchParams, targetTurn, turns]);

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
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            className="text-muted-foreground hover:text-foreground"
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
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download .txt
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

      {!loading && !error && turns.length === 0 && (
        <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
          No transcript available for this session.
        </div>
      )}

      {!loading && !error && targetMissing && (
        <div role="status" className="border border-amber-300 bg-amber-50 rounded-lg p-3 text-sm text-amber-900">
          The requested transcript turn is unavailable. The rest of the transcript is still shown below.
        </div>
      )}

      {!loading && !error && turns.length > 0 && (
        <div className="space-y-3">
          {turns.map((turn) => {
            const isAI = turn.speaker === "ai";
            const isTarget = turn.turn_number === targetTurn;
            return (
              <div
                key={turn.id}
                id={`turn-${turn.turn_number}`}
                ref={(element) => { turnRefs.current[turn.id] = element; }}
                tabIndex={-1}
                aria-label={`${isAI ? "AI interviewer" : "Candidate"}, turn ${turn.turn_number}`}
                className={`rounded-lg p-4 ${
                  isAI
                    ? "bg-muted border"
                    : "bg-background border border-primary/20"
                } ${isTarget ? "ring-2 ring-primary ring-offset-2" : ""}`}
              >
                <p
                  className={`text-xs font-semibold mb-1 ${
                    isAI ? "text-muted-foreground" : "text-primary"
                  }`}
                >
                  {isAI ? "AI Interviewer" : "Candidate"} · Turn {turn.turn_number}
                </p>
                <p className="text-sm whitespace-pre-wrap">{turn.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
