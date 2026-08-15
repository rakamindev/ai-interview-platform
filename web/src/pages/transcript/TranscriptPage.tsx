import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { sessionsApi } from "@/services/sessions";
import {
  ArrowLeft,
  Download,
  Printer,
  FileDown,
  User,
  Bot,
  MessagesSquare,
  Sparkles,
  FileText,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranscriptTurn, Session } from "@/types";

export default function TranscriptPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [session, setSession] = useState<Session | null>(null);
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
        setSession(sRes.data.session);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleDownloadTxt = () => {
    if (turns.length === 0) return;
    const lines = turns.map((t) => {
      const label = t.speaker === "ai" ? "Rakamin AI Interviewer" : (candidateName || "Candidate");
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

  const handleDownloadPdf = () => {
    if (turns.length === 0) return;

    const candidate = candidateName || "Kandidat";
    const role = session?.assessment_name || session?.role_title || "Posisi Wawancara";
    const dateFormatted = new Date(session?.created_at || Date.now()).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const turnsHtml = turns
      .map((t) => {
        const isAI = t.speaker === "ai";
        return `
          <div style="margin-bottom: 16px; display: flex; flex-direction: column; align-items: ${isAI ? "flex-start" : "flex-end"};">
            <div style="font-size: 11px; font-weight: 700; color: ${isAI ? "#0d9488" : "#475569"}; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px;">
              ${isAI ? "🤖 Rakamin AI Interviewer" : `👤 ${candidate}`}
            </div>
            <div style="max-width: 85%; padding: 12px 16px; border-radius: 14px; font-size: 13px; line-height: 1.6; background-color: ${
              isAI ? "#f8fafc" : "#0f172a"
            }; color: ${isAI ? "#1e293b" : "#ffffff"}; border: 1px solid ${
          isAI ? "#e2e8f0" : "#0f172a"
        }; box-shadow: 0 1px 2px rgba(0,0,0,0.05); white-space: pre-wrap;">
              ${t.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
            </div>
          </div>
        `;
      })
      .join("");

    const docHtml = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Transkrip Wawancara - ${candidate} (Sesi #${sessionId})</title>
        <style>
          @page {
            size: A4;
            margin: 18mm 15mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 24px;
            background: #fff;
          }
          .header {
            border-bottom: 2px solid #0d9488;
            padding-bottom: 16px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .brand {
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
          }
          .brand span {
            color: #0d9488;
          }
          .meta-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 12px 16px;
            margin-bottom: 24px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 16px;
            font-size: 12px;
          }
          .meta-item {
            display: flex;
            flex-direction: column;
          }
          .meta-label {
            color: #64748b;
            font-size: 11px;
            font-weight: 600;
          }
          .meta-value {
            color: #0f172a;
            font-weight: 700;
            margin-top: 2px;
          }
          .transcript-container {
            margin-top: 10px;
          }
          .footer {
            margin-top: 30px;
            border-top: 1px solid #e2e8f0;
            padding-top: 12px;
            font-size: 11px;
            color: #94a3b8;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">Rakamin <span>AI Interview</span></div>
            <div style="font-size: 13px; color: #64748b; margin-top: 4px; font-weight: 500;">Official Audio Interview Transcript</div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #64748b;">
            <div>Session ID: #${sessionId}</div>
            <div>Generated: ${new Date().toLocaleDateString("id-ID")}</div>
          </div>
        </div>

        <div class="meta-box">
          <div class="meta-item">
            <span class="meta-label">Nama Kandidat</span>
            <span class="meta-value">${candidate}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Posisi Lowongan</span>
            <span class="meta-value">${role}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Waktu Sesi Wawancara</span>
            <span class="meta-value">${dateFormatted}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Total Percakapan</span>
            <span class="meta-value">${turns.length} Dialog Turns (Live Audio 16kHz)</span>
          </div>
        </div>

        <div class="transcript-container">
          ${turnsHtml}
        </div>

        <div class="footer">
          Dokumen ini merupakan rekaman transkrip otomatis resmi dari sesi wawancara suara platform Rakamin AI Interview.
        </div>
      </body>
      </html>
    `;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(docHtml);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }, 300);
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
          <div className="space-y-1 min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Transkrip Percakapan Sesi #{sessionId}
            </h1>
            {candidateName && (
              <div className="flex items-center gap-2 pt-0.5">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 max-w-[280px] sm:max-w-md truncate"
                  title={candidateName}
                >
                  <User className="h-3 w-3 shrink-0" />
                  <span className="truncate">{candidateName}</span>
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">Kandidat</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              Seluruh rekaman dialog suara dua arah antara AI Pewawancara dan Kandidat.
            </p>
          </div>
        </div>

        {/* Action Buttons: Download PDF & TXT */}
        {!loading && !error && turns.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              className="h-9 px-3 text-xs font-semibold border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer flex items-center gap-1.5"
              title="Unduh / Cetak Transkrip sebagai PDF Resmi"
            >
              <FileDown className="h-3.5 w-3.5 text-primary" />
              <span>Unduh PDF</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTxt}
              className="h-9 px-3 text-xs font-semibold border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer flex items-center gap-1.5"
              title="Unduh Transkrip Teks Mentah"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Unduh .txt</span>
            </Button>
          </div>
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
