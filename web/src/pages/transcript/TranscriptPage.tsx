import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionsApi } from "@/services/sessions";
import { ArrowLeft, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import Breadcrumb from "@/components/layout/Breadcrumb";
import Page from "@/components/layout/Page";
import type { TranscriptTurn } from "@/types";

export default function TranscriptPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [assessmentName, setAssessmentName] = useState<string | null>(null);
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
        setAssessmentName(sRes.data.assessment?.name ?? null);
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
    <Page width="document" className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="min-w-0 space-y-1.5">
          <Breadcrumb
            crumbs={[
              { label: "Assessments", to: "/assessments" },
              { label: assessmentName ?? "Candidates", to: `/assessments/${id}/invite` },
              { label: candidateName ?? "Candidate" },
              { label: "Transcript" },
            ]}
          />
          <h1 className="text-lg font-semibold">Interview Transcript</h1>
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

      {!loading && !error && turns.length > 0 && (
        <div className="space-y-3">
          {turns.map((turn) => {
            const isAI = turn.speaker === "ai";
            return (
              /* Full-bleed container, but the speaker sits in a fixed gutter
                 and the words keep their own measure — the width buys a
                 clearer two-column script, not longer lines. */
              <div
                key={turn.id}
                className={cn(
                  "rounded-lg border p-4 sm:grid sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4",
                  isAI ? "border-border bg-muted" : "border-primary/20 bg-background",
                )}
              >
                <p
                  className={cn(
                    "mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] sm:mb-0 sm:pt-0.5",
                    isAI ? "text-muted-foreground" : "text-primary",
                  )}
                >
                  {isAI ? "AI Interviewer" : "Candidate"}
                </p>
                {/* This page is nothing but verbatim speech, so it is the last
                    place that should break the rule the rest of the product
                    keeps: the candidate's own words carry the serif, and only
                    machine-written text stays in the interface sans. */}
                <p
                  className={cn(
                    "max-w-prose whitespace-pre-wrap [overflow-wrap:anywhere]",
                    isAI
                      ? "text-sm leading-relaxed"
                      : "font-serif text-[15px] leading-relaxed",
                  )}
                >
                  {turn.text}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
