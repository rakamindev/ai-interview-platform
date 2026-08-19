import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { sessionsApi } from "@/services/sessions";
import { Download, Bot, User, Copy, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranscriptTurn } from "@/types";

export default function TranscriptPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const [searchParams] = useSearchParams();
  const highlightQuery = searchParams.get("highlight") || "";

  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [assessmentName, setAssessmentName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copiedTurnId, setCopiedTurnId] = useState<number | null>(null);

  const highlightedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    Promise.all([
      sessionsApi.getTranscript(Number(sessionId)),
      sessionsApi.get(Number(sessionId)),
    ])
      .then(([tRes, sRes]) => {
        setTurns(tRes.data.turns);
        const sess = sRes.data.session as any;
        setCandidateName(sess.candidate_name ?? null);
        setAssessmentName(sess.assessment?.name ?? null);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [turns, highlightQuery]);

  const handleDownload = () => {
    const lines = turns.map((t) => {
      const label = t.speaker === "ai" ? "AI Interviewer" : "Candidate";
      return `[${label} · Turn #${t.turn_number}]\n${t.text}`;
    });
    const blob = new Blob([lines.join("\n\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-session-${sessionId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyTurn = (turnId: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTurnId(turnId);
    setTimeout(() => setCopiedTurnId(null), 2000);
  };

  if (loading) return <LoadingState rows={6} />;
  if (error) return <ErrorState title="Failed to load transcript" onRetry={() => window.location.reload()} />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Session Transcript"
        description={`${assessmentName || "Technical Assessment"} · Candidate: ${candidateName || "Candidate #" + sessionId} · Total: ${turns.length} turns`}
        backHref={`/assessments/${id}/sessions/${sessionId}/portfolio`}
        backLabel="Portfolio Results"
        actions={
          turns.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download .txt
            </Button>
          )
        }
      />

      {highlightQuery && (
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>Showing evidence turn for quote: "{highlightQuery}"</span>
        </div>
      )}

      {turns.length === 0 ? (
        <Card className="p-12 text-center text-xs text-muted-foreground">
          No conversation turns recorded for this session.
        </Card>
      ) : (
        <div className="space-y-3">
          {turns.map((turn) => {
            const isAI = turn.speaker === "ai";
            const isHighlighted =
              highlightQuery &&
              turn.text.toLowerCase().includes(highlightQuery.toLowerCase());

            return (
              <div
                key={turn.id}
                ref={isHighlighted ? highlightedRef : undefined}
                className={cn(
                  "p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-xs space-y-2 transition-all",
                  isHighlighted && "ring-2 ring-primary border-primary bg-primary/5 shadow-md",
                  !isHighlighted && isAI && "bg-muted/40 border-border text-foreground",
                  !isHighlighted && !isAI && "bg-card border-border text-foreground sm:ml-3 shadow-xs"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isAI ? (
                      <span className="flex items-center gap-1.5 font-bold text-primary">
                        <Bot className="h-3.5 w-3.5" /> AI Interviewer
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 font-bold text-teal-600 dark:text-teal-400">
                        <User className="h-3.5 w-3.5" /> {candidateName || "Candidate"}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Turn #{turn.turn_number}
                    </span>
                  </div>

                  <button
                    onClick={() => handleCopyTurn(turn.id, turn.text)}
                    className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
                    title="Copy text"
                  >
                    {copiedTurnId === turn.id ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground">
                  {turn.text}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
