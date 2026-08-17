import { useEffect, useState, useRef } from "react";
import { CheckCircle, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { sessionsApi } from "@/services/sessions";
import type { CandidateInfo } from "@/types";

interface ThankYouScreenProps {
  token: string;
  initialInfo: CandidateInfo | null;
}

const POLL_INTERVAL = 5000;   // 5s
const POLL_TIMEOUT = 180000; // stop after 3 menit

export default function ThankYouScreen({ token, initialInfo }: ThankYouScreenProps) {
  const [summary, setSummary] = useState(initialInfo?.portfolio_summary ?? null);
  const [pollingDone, setPollingDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    // Jika summary sudah complete dari data awal, tidak perlu polling
    if (summary?.status === "complete") {
      setPollingDone(true);
      return;
    }

    // Portfolio belum ready — poll candidate_info sampai complete atau timeout
    timerRef.current = setInterval(async () => {
      elapsedRef.current += POLL_INTERVAL;

      if (elapsedRef.current >= POLL_TIMEOUT) {
        clearInterval(timerRef.current!);
        setPollingDone(true);
        return;
      }

      try {
        const res = await sessionsApi.getCandidateInfo(token);
        const ps = res.data.portfolio_summary;
        if (ps) {
          setSummary(ps);
          if (ps.status === "complete" || ps.status === "failed") {
            clearInterval(timerRef.current!);
            setPollingDone(true);
          }
        }
      } catch {
        // transient error — retry on next tick
      }
    }, POLL_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [token]);

  const isReady = summary?.status === "complete";
  const isFailed = summary?.status === "failed";
  const isPending = !pollingDone && !isReady;

  return (
    <div className="max-w-xl mx-auto px-4 py-16 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <CheckCircle className="h-12 w-12 text-green-500" />
        </div>
        <h2 className="text-2xl font-semibold">Interview Selesai</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Terima kasih. Rekaman interview kamu telah disimpan dan akan
          ditinjau oleh tim perekrut.
        </p>
      </div>

      {/* Portfolio summary */}
      {isPending && (
        <div className="rounded-xl border bg-muted/30 px-5 py-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>Hasil sedang diproses, Anda bisa kembali ke halaman ini beberapa menit lagi…</span>
        </div>
      )}

      {isFailed && pollingDone && (
        <div className="rounded-xl border bg-muted/30 px-5 py-6 text-center text-sm text-muted-foreground">
          Analisis hasil tidak tersedia saat ini. Tim kami akan meninjau
          interview kamu secara manual.
        </div>
      )}

      {isReady && summary && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-center text-muted-foreground">
            Ringkasan hasil interview kamu
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Strengths */}
            <div className="rounded-xl border bg-green-50/60 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />
                <span className="text-sm font-semibold text-green-700">
                  Kelebihan
                </span>
              </div>
              {summary.strengths.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Tidak ada kelebihan yang teridentifikasi.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {summary.strengths.map((s) => (
                    <li key={s} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 text-green-500">✓</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Gaps */}
            <div className="rounded-xl border bg-orange-50/60 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-orange-500 shrink-0" />
                <span className="text-sm font-semibold text-orange-600">
                  Area Pengembangan
                </span>
              </div>
              {summary.gaps.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Tidak ada area yang perlu dikembangkan.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {summary.gaps.map((g) => (
                    <li key={g} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 text-orange-400">○</span>
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <p className="text-xs text-center text-muted-foreground pt-1">
            Penilaian ini bersifat indikatif dan dapat disesuaikan oleh tim
            perekrut.
          </p>
        </div>
      )}

      {/* Timeout — portfolio tidak kunjung ready */}
      {pollingDone && !isReady && !isFailed && (
        <div className="rounded-xl border bg-muted/30 px-5 py-6 text-center text-sm text-muted-foreground">
          Analisis masih berjalan. Kamu akan dihubungi tim perekrut untuk
          hasilnya.
        </div>
      )}
    </div>
  );
}
