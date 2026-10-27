import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Info, FileText, CheckCircle2 } from "lucide-react";

interface PrivacyConsentModalProps {
  open: boolean;
  onConsentAccepted: () => void;
  candidateName?: string | null;
  roleTitle?: string;
}

export default function PrivacyConsentModal({
  open,
  onConsentAccepted,
  candidateName,
  roleTitle = "AI Technical Interview",
}: PrivacyConsentModalProps) {
  const [agreed, setAgreed] = useState(false);
  const [showFullNotice, setShowFullNotice] = useState(false);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md sm:max-w-lg p-6 space-y-4">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              Kepatuhan UU PDP No. 27/2022
            </span>
          </div>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Persetujuan Pemrosesan Data &amp; Asesmen AI
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Sesuai Undang-Undang Pelindungan Data Pribadi (UU PDP No. 27 Tahun 2022), kami berkewajiban menyampaikan transparansi atas pengumpulan dan pemrosesan data pribadi Anda selama sesi asesmen {roleTitle}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 bg-muted/40 border rounded-lg p-4 text-xs text-foreground/90">
          <div className="flex items-start gap-2.5">
            <div className="p-1 rounded bg-blue-50 text-blue-600 shrink-0 mt-0.5">
              <Info className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">1. Perekaman Suara &amp; Transkripsi Real-Time</p>
              <p className="text-muted-foreground mt-0.5">
                Mikrofon Anda akan merekam percakapan untuk ditranskripsikan secara langsung guna menganalisis respons kompetensi teknis dan profesional.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="p-1 rounded bg-purple-50 text-purple-600 shrink-0 mt-0.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">2. Penilaian Otomatis Berbasis AI</p>
              <p className="text-muted-foreground mt-0.5">
                Model AI mengevaluasi kedalaman penjelasan Anda (L1–L5) berdasarkan bukti kutipan verbatim. Rekomendasi AI dapat dikalibrasi oleh penilai manusia (Assessor).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="p-1 rounded bg-amber-50 text-amber-600 shrink-0 mt-0.5">
              <FileText className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">3. Kerahasiaan &amp; Hak Subjek Data</p>
              <p className="text-muted-foreground mt-0.5">
                Data pribadi dilindungi enkripsi, tidak disebarluaskan, dan hanya digunakan untuk keperluan rekrutmen. Anda berhak mendapatkan transparansi rubrik penilaian.
              </p>
            </div>
          </div>
        </div>

        {showFullNotice && (
          <div className="max-h-32 overflow-y-auto text-xs bg-slate-50 border border-slate-200 rounded p-3 text-slate-700 space-y-1.5">
            <p className="font-semibold">Ketentuan Tambahan Retensi &amp; Keamanan Data:</p>
            <p>• Data audio dienkripsi selama transmisi (WSS/TLS) dan transkrip disimpan dalam basis data terisolasi multi-tenant.</p>
            <p>• Log server disaring untuk mencegah kebocoran data sensitif (PII sanitization).</p>
            <p>• Anda dapat mengakhiri wawancara kapan saja melalui tombol "End Interview".</p>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            className="text-xs text-primary underline underline-offset-4 hover:opacity-80"
            onClick={() => setShowFullNotice(!showFullNotice)}
          >
            {showFullNotice ? "Sembunyikan rincian hukum" : "Lihat rincian hak hukum Anda →"}
          </button>
        </div>

        <div className="pt-2 border-t">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              id="privacy-consent-checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span className="text-xs text-foreground leading-normal font-medium">
              Saya {candidateName ? `(${candidateName})` : ""} telah membaca, memahami, dan memberikan persetujuan eksplisit untuk perekaman audio dan evaluasi berbasis AI sesuai ketentuan UU PDP.
            </span>
          </label>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            className="w-full"
            disabled={!agreed}
            onClick={() => {
              if (agreed) onConsentAccepted();
            }}
          >
            Lanjutkan ke Pengecekan Perangkat (Hardware Check) →
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
