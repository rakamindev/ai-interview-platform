import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Lock, FileText, UserCheck, AlertCircle } from "lucide-react";

interface CandidatePDPNoticeProps {
  onConsentChange: (consented: boolean) => void;
  consented: boolean;
}

export default function CandidatePDPNotice({ onConsentChange, consented }: CandidatePDPNoticeProps) {
  const [showFullTerms, setShowFullTerms] = useState(false);

  return (
    <Card className="border-primary/20 bg-primary/[0.02] shadow-sm">
      <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
        <div className="flex items-center gap-2 text-primary font-medium">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">
            Persetujuan Pemrosesan Data Pribadi (UU PDP No. 27/2022)
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Candidate Personal Data Protection &amp; Voice Recording Notice
        </p>
      </CardHeader>

      <CardContent className="space-y-4 px-4 sm:px-6 pb-5 text-xs text-muted-foreground leading-relaxed">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-start gap-2 p-2.5 rounded-md bg-background border">
            <Lock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground block">Rekaman Suara &amp; Biometrik</span>
              Data audio dienkripsi dan diproses khusus untuk sesi wawancara ini.
            </div>
          </div>
          <div className="flex items-start gap-2 p-2.5 rounded-md bg-background border">
            <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground block">Transkripsi &amp; Analisis AI</span>
              Transkripsi dianalisis oleh AI terhadap rubrik kompetensi peran kerja.
            </div>
          </div>
          <div className="flex items-start gap-2 p-2.5 rounded-md bg-background border">
            <UserCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground block">Pengawasan Manusia (Human-in-Loop)</span>
              Hasil evaluasi AI selalu ditinjau dan dapat di-override oleh penilai manusia.
            </div>
          </div>
          <div className="flex items-start gap-2 p-2.5 rounded-md bg-background border">
            <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground block">Hak Subjek Data</span>
              Data disimpan terbatas selama proses rekrutmen dan dilindungi kerahasiaannya.
            </div>
          </div>
        </div>

        {showFullTerms && (
          <div className="p-3 rounded bg-muted/40 border border-muted text-[11px] space-y-1.5 text-foreground/80">
            <p className="font-semibold text-foreground">
              Rincian Kebijakan Privasi Sesuai UU No. 27 Tahun 2022:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
              <li>
                <strong>Data Pribadi Spesifik:</strong> Sesuai Pasal 4 ayat (2), rekaman suara dan data biometrik diproses atas dasar persetujuan eksplisit Anda.
              </li>
              <li>
                <strong>Tujuan Pemrosesan:</strong> Pemrosesan dilakukan semata-mata untuk asesmen kompetensi kerja terkait lowongan yang Anda lamar.
              </li>
              <li>
                <strong>Non-Komersialisasi:</strong> Rekaman audio dan transkrip Anda tidak akan dijual atau digunakan untuk melatih model AI publik.
              </li>
              <li>
                <strong>Pemberitahuan Hak:</strong> Anda berhak menolak atau mengakhiri sesi sewaktu-waktu dengan menekan tombol &ldquo;End Interview&rdquo;.
              </li>
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setShowFullTerms(!showFullTerms)}
            className="text-primary hover:underline text-[11px] font-medium"
          >
            {showFullTerms ? "Sembunyikan rincian UU PDP ▲" : "Lihat ketentuan lengkap UU PDP No. 27/2022 ▼"}
          </button>
        </div>

        <label className="flex items-start gap-2.5 p-3 rounded-lg border border-primary/30 bg-primary/[0.04] cursor-pointer transition-colors hover:bg-primary/[0.07]">
          <input
            type="checkbox"
            checked={consented}
            onChange={(e) => onConsentChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
          />
          <span className="text-xs text-foreground font-medium leading-normal">
            Saya telah membaca, memahami, dan secara sukarela memberikan persetujuan eksplisit untuk perekaman suara, transkripsi, serta pemrosesan evaluasi kompetensi berbasis AI sesuai ketentuan UU No. 27/2022 (UU PDP).
          </span>
        </label>
      </CardContent>
    </Card>
  );
}
