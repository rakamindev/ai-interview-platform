import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionsApi } from "@/services/sessions";
import { ArrowLeft, Download, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
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
    <div className="max-w-2xl mx-auto space-y-4 pb-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold">Interview Transcript</h1>
            {candidateName && (
              <p className="text-sm text-muted-foreground">{candidateName}</p>
            )}
          </div>
        </div>
        {!loading && !error && turns.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden xs:inline">Download .txt</span>
            <span className="xs:hidden">TXT</span>
          </Button>
        )}
      </div>

      {/* ── Turn count pill ── */}
      {!loading && turns.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {turns.length} turn{turns.length !== 1 ? "s" : ""} in this session
        </p>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={cn("flex gap-2", i % 2 === 0 ? "" : "flex-row-reverse")}>
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <Skeleton className="h-16 flex-1 rounded-2xl" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="border rounded-xl p-6 text-center text-sm text-destructive bg-destructive/5">
          Failed to load transcript. Please refresh.
        </div>
      )}

      {!loading && !error && turns.length === 0 && (
        <div className="border rounded-xl p-8 text-center text-sm text-muted-foreground">
          No transcript available for this session.
        </div>
      )}

      {/* ── Chat bubbles ── */}
      {!loading && !error && turns.length > 0 && (
        <div className="space-y-3">
          {turns.map((turn) => {
            const isAI = turn.speaker === "ai";
            return (
              <div
                key={turn.id}
                className={cn(
                  "flex items-end gap-2.5",
                  isAI ? "flex-row" : "flex-row-reverse"
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white",
                    isAI ? "bg-primary" : "bg-secondary-foreground"
                  )}
                >
                  {isAI ? (
                    <Bot className="h-4 w-4" />
                  ) : (
                    <User className="h-3.5 w-3.5" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                    isAI
                      ? "bg-muted rounded-bl-sm text-foreground"
                      : "bg-primary text-primary-foreground rounded-br-sm"
                  )}
                >
                  <p className="whitespace-pre-wrap">{turn.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
