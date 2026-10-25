import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionsApi } from "@/services/sessions";
import { Download } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
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
    <div className="max-w-[740px] mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Breadcrumb items={[
            { label: "Sessions", href: `/assessments/${id}/invite` },
            { label: "Transcript" }
          ]} />
          <h1 className="text-xl font-semibold mt-1">Interview Transcript</h1>
          {candidateName && (
            <p className="text-sm text-gray-500 mt-0.5">{candidateName}</p>
          )}
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
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <p className="text-sm text-red-700">Failed to load transcript. Please refresh.</p>
        </div>
      )}

      {!loading && !error && turns.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl py-16 px-5 text-center">
          <p className="text-sm text-gray-500">No transcript available for this session.</p>
        </div>
      )}

      {!loading && !error && turns.length > 0 && (
        <div className="space-y-0">
          {turns.map((turn) => {
            const isAI = turn.speaker === "ai";
            return (
              <div key={turn.id} className="group">
                <div className="flex gap-4">
                  {/* Left border indicator */}
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-1.5 rounded-full flex-shrink-0 self-stretch",
                      isAI ? "bg-teal-500" : "bg-blue-400"
                    )} />
                  </div>

                  {/* Content */}
                  <div className="py-4 flex-1 min-w-0">
                    <p className={cn(
                      "text-[10px] font-bold uppercase tracking-widest mb-1.5",
                      isAI ? "text-teal-600" : "text-blue-600"
                    )}>
                      {isAI ? "AI INTERVIEWER" : "CANDIDATE"}
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{turn.text}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
