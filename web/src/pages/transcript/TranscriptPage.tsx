import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { sessionsApi } from "@/services/sessions";
import { Download } from "lucide-react";
import type { TranscriptTurn } from "@/types";

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Interview Transcript</h1>
          <p className="text-sm text-muted-foreground">
            {candidateName ? `Candidate: ${candidateName} · ` : ""}Full dialogue history between the candidate and AI interviewer.
          </p>
        </div>
        {!loading && !error && turns.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download .txt
          </Button>
        )}
      </div>

      <Separator />

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="border p-6 text-center text-sm text-destructive">
          Failed to load transcript. Please refresh.
        </div>
      )}

      {!loading && !error && turns.length === 0 && (
        <div className="border p-6 text-center text-sm text-muted-foreground">
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
                className={`p-4 ${
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
    </div>
  );
}
