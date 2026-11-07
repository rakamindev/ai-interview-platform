import React, { useState } from "react";
import { ShieldCheck, Lock, AlertCircle, FileText, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { sessionsApi } from "@/services/sessions";

interface CandidateConsentModalProps {
  token: string;
  roleTitle: string;
  timeLimitMin: number;
  onConsentGranted: () => void;
}

export default function CandidateConsentModal({
  token,
  roleTitle,
  timeLimitMin,
  onConsentGranted,
}: CandidateConsentModalProps) {
  const [retentionAccepted, setRetentionAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!retentionAccepted) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await sessionsApi.recordConsent(token, {
        pdp_retention_acknowledged: true,
        consent_version: "v1.0-uupdp-2022",
      });
      onConsentGranted();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.errors?.[0]?.message ||
        err.response?.data?.error ||
        "Gagal menyimpan persetujuan data. Silakan periksa koneksi internet Anda.";
      setErrorMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border rounded-xl shadow-sm p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center justify-center p-2.5 bg-blue-50 text-blue-700 rounded-full mb-1">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Persetujuan Privasi & Wawancara AI
          </h2>
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
            UU PDP No. 27/2022
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Sebelum memulai wawancara untuk posisi <strong>{roleTitle}</strong> ({timeLimitMin} menit), mohon pelajari informasi perlindungan data pribadi Anda di bawah ini.
        </p>
      </div>

      {/* Disclosures & Candidate Rights */}
      <div className="space-y-3.5 text-xs sm:text-sm">
        <div className="p-3.5 bg-slate-50 border rounded-lg flex items-start gap-3">
          <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-foreground">1. Transparansi Pemrosesan AI</span>
            <p className="text-muted-foreground leading-relaxed">
              Wawancara ini dipandu oleh model kecerdasan buatan secara real-time. AI akan mengajukan pertanyaan teknis, mendengarkan respon Anda, dan mengevaluasi indikator kompetensi berdasarkan rubrik baku.
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 border rounded-lg flex items-start gap-3">
          <Lock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-foreground">2. Pengolahan Data Suara & Transkrip</span>
            <p className="text-muted-foreground leading-relaxed">
              Aliran suara mikrofon Anda diproses secara terenkripsi menggunakan Google Gemini Live API untuk menghasilkan transkrip percakapan dan ringkasan bukti keahlian bagi tim perekrut. Data Anda tidak digunakan untuk melatih model publik.
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 border rounded-lg flex items-start gap-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-foreground">3. Hak Subjek Data & Evaluasi Manusia</span>
            <p className="text-muted-foreground leading-relaxed">
              Sesuai UU PDP Indonesia, keputusan seleksi akhir tetap berada di tangan penilai manusia (*Human-in-the-Loop*). Anda berhak mendapatkan penjelasan atas penilaian kompetensi dan mengajukan sanggahan apabila diperlukan.
            </p>
          </div>
        </div>
      </div>

      {/* Error state */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Checkbox consent */}
      <div className="pt-2 border-t space-y-4">
        <label className="flex items-start gap-3 cursor-pointer select-none group">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            checked={retentionAccepted}
            onChange={(e) => setRetentionAccepted(e.target.checked)}
            aria-label="Persetujuan eksplisit kandidat"
          />
          <span className="text-xs sm:text-sm text-foreground/90 group-hover:text-foreground">
            Saya telah membaca, memahami, dan memberikan <strong>persetujuan eksplisit (*explicit consent*)</strong> atas pengolahan data suara serta transkrip saya untuk keperluan evaluasi kompetensi rekrutmen ini.
          </span>
        </label>

        <Button
          className="w-full"
          size="lg"
          disabled={!retentionAccepted || isSubmitting}
          onClick={handleAccept}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Menyimpan Persetujuan...
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4 mr-2" />
              Setuju & Lanjutkan ke Pemeriksaan Perangkat
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

