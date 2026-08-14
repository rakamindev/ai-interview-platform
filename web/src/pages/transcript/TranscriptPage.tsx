import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { sessionsApi } from "@/services/sessions";
import {
  ArrowLeft,
  Download,
  Bot,
  User,
  MessagesSquare,
  Sparkles,
  FileText,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranscriptTurn } from "@/types";

export default function TranscriptPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
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
    if (turns.length === 0) return;
    const lines = turns.map((t) => {
      const label = t.speaker === "ai" ? "AI Interviewer" : (candidateName || "Candidate");
      return `[${label}]\n${t.text}`;
    });
    const blob = new Blob([lines.join("\n\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Transcript-${(candidateName || "Candidate").replace(/\s+/g, "_")}-Session-${sessionId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-12">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors shadow-2xs shrink-0 cursor-pointer"
            title="Kembali ke Halaman Sebelumnya"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Interview Transcript
              </h1>
              {candidateName && (
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-semibold px-2.5 py-0.5 text-xs">
                  {candidateName}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Seluruh rekaman dialog suara dua arah antara AI Pewawancara dan Kandidat.
            </p>
          </div>
        </div>

        {/* Download .txt button */}
        {!loading && !error && turns.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="h-9 px-3 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs shrink-0"
          >
            <Download className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
            <span>Unduh Transkrip (.txt)</span>
          </Button>
        )}
      </div>

      {/* ── Turn count pill ── */}
      {!loading && !error && turns.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-slate-200/80 pb-2">
          <span>Total {turns.length} interaksi percakapan kerekam</span>
          <span className="text-[11px] bg-slate-100 px-2 py-0.5 rounded-md font-medium text-slate-600">
            Audio Live 16kHz Streaming
          </span>
        </div>
      )}

      {/* ── Loading Skeleton ── */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={cn("flex gap-3", i % 2 === 0 ? "" : "flex-row-reverse")}>
              <Skeleton className="h-9 w-9 rounded-2xl shrink-0" />
              <Skeleton className="h-20 flex-1 rounded-2xl" />
            </div>
          ))}
        </div>
      )}

      {/* ── Error State ── */}
      {!loading && error && (
        <div className="bg-white rounded-3xl border border-rose-200/80 bg-rose-50/20 p-8 text-center space-y-3 shadow-2xs">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center border border-rose-200">
            <AlertCircle className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-rose-900">Gagal memuat transkrip percakapan.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="rounded-xl text-xs"
          >
            Muat Ulang Halaman
          </Button>
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && !error && turns.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-10 text-center space-y-4 shadow-2xs">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200 shadow-xs">
            <MessagesSquare className="h-7 w-7" />
          </div>
          
          <div className="space-y-1 max-w-sm mx-auto">
            <h2 className="text-base font-bold text-slate-900">Transkrip Percakapan Kosong</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tidak ada rekaman percakapan suara yang tersimpan untuk sesi wawancara ini. Hal ini terjadi jika sesi terputus sebelum interaksi suara dimulai.
            </p>
          </div>

          <Button asChild variant="outline" size="sm" className="rounded-xl text-xs font-semibold border-slate-200">
            <Link to={id ? `/assessments/${id}/sessions/${sessionId}/portfolio` : "/candidates"}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              <span>Kembali ke Portofolio</span>
            </Link>
          </Button>
        </div>
      )}

      {/* ── Chat bubbles ── */}
      {!loading && !error && turns.length > 0 && (
        <div className="space-y-4 bg-white/60 border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-2xs">
          {turns.map((turn) => {
            const isAI = turn.speaker === "ai";
            return (
              <div
                key={turn.id}
                className={cn(
                  "flex items-start gap-3",
                  isAI ? "flex-row" : "flex-row-reverse"
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-2xs font-bold text-xs",
                    isAI
                      ? "bg-gradient-to-br from-teal-500 to-teal-700"
                      : "bg-gradient-to-br from-primary to-primary/80"
                  )}
                >
                  {isAI ? (
                    <Bot className="h-4 w-4" />
                  ) : (
                    (candidateName || "K").slice(0, 1).toUpperCase()
                  )}
                </div>

                {/* Bubble Container */}
                <div className={cn("flex flex-col max-w-[82%]", isAI ? "items-start" : "items-end")}>
                  <span className="text-[11px] font-semibold text-slate-500 mb-1 px-1">
                    {isAI ? "AI Interviewer" : (candidateName || "Kandidat")}
                  </span>
                  
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-2xs",
                      isAI
                        ? "bg-slate-100/90 text-slate-900 border border-slate-200/60 rounded-tl-xs"
                        : "bg-primary text-white rounded-tr-xs"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{turn.text}</p>
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
