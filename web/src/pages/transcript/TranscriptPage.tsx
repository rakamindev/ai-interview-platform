import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionsApi } from "@/services/sessions";
import { ArrowLeft, Download, FileText } from "lucide-react";
import type { TranscriptTurn } from "@/types";
import HeroBanner from "@/components/common/HeroBanner";
import RakaminSpinner from "@/components/common/RakaminSpinner";

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
      <div className="max-w-4xl mx-auto py-12">
        <RakaminSpinner text="Memuat transkrip percakapan sesi wawancara..." size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-2 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#01959f]" />
              Detail Percakapan
            </h2>
            {candidateName && (
              <p className="text-xs text-slate-500">Kandidat: <span className="font-semibold text-slate-700">{candidateName}</span></p>
            )}
          </div>
        </div>
        {!loading && !error && turns.length > 0 && (
          <Button
            variant="cta"
            size="sm"
            onClick={handleDownload}
            className="w-full sm:w-auto rounded-xl text-xs shadow-xs font-bold h-10 sm:h-9 justify-center"
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Download .txt
          </Button>
        )}
      </div>

      {/* Hero Banner */}
      <HeroBanner
        badgeText="⭐️ Verbatim Conversation Record"
        title={candidateName ? `Transkrip Wawancara: ${candidateName}` : "Transkrip Lengkap Sesi Wawancara"}
        highlightText="Audio to Text"
        subtitle="Rekaman percakapan dua arah antara AI Assessor dan kandidat dengan penanda waktu & speaker label."
        bulletPoints={[
          "Transkripsi audio verbatim terproteksi privasi UU PDP",
          "Penanda giliran bicara (AI Assessor vs Candidate)",
          "Ekspor transkrip teks lengkap untuk audit & evaluasi lanjutan",
        ]}
        imageSrc="/images/interview.png"
        imageAlt="Rakamin Interview Transcript"
        imageFloatingBadge={{
          title: "Auditable Record",
          subtitle: "UU PDP Compliant",
        }}
      />

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
    </div>
  );
}
