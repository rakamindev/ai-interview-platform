import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionsApi } from "@/services/sessions";
import {
  ArrowLeft,
  Download,
  Bot,
  User,
  Copy,
  Check,
  FileText,
  Clock,
  Sparkles
} from "lucide-react";
import type { TranscriptTurn } from "@/types";

export default function TranscriptPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [roleTitle, setRoleTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      sessionsApi.getTranscript(Number(sessionId)),
      sessionsApi.get(Number(sessionId)),
    ])
      .then(([tRes, sRes]) => {
        setTurns(tRes.data.turns || []);
        setCandidateName(sRes.data.session.candidate_name ?? null);
        setRoleTitle(sRes.data.session.assessment?.name ?? null);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleDownload = () => {
    const lines = turns.map((t) => {
      const label = t.speaker === "ai" ? "AI INTERVIEWER" : "CANDIDATE";
      return `[Turn ${t.turn_number} - ${label}]\n${t.text}\n`;
    });
    const header = `Transkrip Wawancara Teknis Rakamin AI\nKandidat: ${candidateName || "Kandidat"}\nPosisi: ${roleTitle || "Technical Role"}\nTanggal Unduh: ${new Date().toLocaleString()}\n\n=========================================\n\n`;
    const blob = new Blob([header + lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-session-${sessionId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyTurn = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <Link
          to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
          className="hover:text-teal-700 flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Kembali ke Hasil Portfolio</span>
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-semibold">Transkrip Lengkap</span>
      </div>

      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-teal-700" /> Transkrip Sesi #{sessionId}
            </span>
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" /> Gemini Live Speech
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Transkrip Wawancara: {candidateName || "Kandidat"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Posisi: <strong>{roleTitle || "Technical Role"}</strong> • Total {turns.length} dialog tercatat
          </p>
        </div>

        {!loading && !error && turns.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="rounded-xl border-slate-200 text-xs h-9 bg-white shadow-2xs font-medium self-start sm:self-auto"
          >
            <Download className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
            Unduh Transkrip (.txt)
          </Button>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="border border-red-200 bg-red-50/80 rounded-2xl p-8 text-center text-sm text-red-700 shadow-2xs">
          Gagal memuat transkrip. Silakan muat ulang halaman.
        </div>
      )}

      {!loading && !error && turns.length === 0 && (
        <div className="border border-dashed border-slate-300 rounded-3xl p-12 text-center bg-white shadow-2xs space-y-2">
          <FileText className="h-8 w-8 text-slate-300 mx-auto" />
          <h3 className="font-semibold text-slate-800 text-sm">Belum Ada Transkrip</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Sesi ini belum memiliki pertukaran dialog atau percakapan yang terekam.
          </p>
        </div>
      )}

      {!loading && !error && turns.length > 0 && (
        <div className="space-y-4">
          {turns.map((turn, index) => {
            const isAI = turn.speaker === "ai";
            return (
              <div
                key={turn.id ?? index}
                className={`rounded-2xl p-5 border transition-all shadow-2xs ${
                  isAI
                    ? "bg-slate-50/90 border-slate-200/90 text-slate-900"
                    : "bg-white border-teal-200/80 text-slate-900 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/50 text-xs">
                  <div className="flex items-center gap-2">
                    {isAI ? (
                      <div className="flex items-center gap-1.5 font-bold text-teal-800">
                        <div className="p-1 bg-teal-100 rounded-md">
                          <Bot className="h-3.5 w-3.5 text-teal-700" />
                        </div>
                        <span>AI Interviewer</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <div className="p-1 bg-slate-100 rounded-md">
                          <User className="h-3.5 w-3.5 text-slate-700" />
                        </div>
                        <span>{candidateName || "Kandidat"}</span>
                      </div>
                    )}
                    <span className="text-[11px] font-mono text-slate-600 bg-white/80 px-2 py-0.5 rounded-md border border-slate-200/60">
                      Turn #{turn.turn_number ?? index + 1}
                    </span>
                  </div>

                  <button
                    onClick={() => copyTurn(turn.text, index)}
                    className="text-slate-600 hover:text-slate-800 p-1 rounded-md hover:bg-white transition-colors"
                    title="Salin teks dialog"
                  >
                    {copiedIndex === index ? (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-800 font-medium">
                        <Check className="h-3 w-3" /> Tersalin
                      </span>
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                <p className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-slate-800">
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
