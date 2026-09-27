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
import { ShieldCheck, AlertCircle } from "lucide-react";

export interface PreFlightConsentModalProps {
  isOpen: boolean;
  onConsent: () => void;
  onDecline?: () => void;
}

export const PreFlightConsentModal: React.FC<PreFlightConsentModalProps> = ({
  isOpen,
  onConsent,
  onDecline,
}) => {
  const [agreed, setAgreed] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && onDecline) onDecline(); }}>
      <DialogContent className="max-w-lg" data-testid="pre-flight-consent-modal">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
            <DialogTitle className="text-lg font-semibold">
              Persetujuan Pemrosesan Data Pribadi (UU PDP No. 27/2022)
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Pemberitahuan hukum wajib sebelum memulai sesi wawancara berbasis kecerdasan buatan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm text-muted-foreground leading-relaxed">
          <div className="bg-muted/40 p-3 rounded-md space-y-2 text-xs">
            <p className="font-medium text-foreground">
              Sesuai dengan Undang-Undang Republik Indonesia Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP):
            </p>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>
                <strong>Pemrosesan Data Biometrik Suara:</strong> Suara dan rekaman audio Anda akan ditransmisikan secara langsung (streaming) melalui koneksi terenkripsi TLS ke Google Gemini Live untuk keperluan transkripsi real-time dan penilaian kompetensi teknis.
              </li>
              <li>
                <strong>Dukungan Keputusan Manusia (Decision-Support Dossier):</strong> Hasil penilaian AI hanya digunakan sebagai bahan pertimbangan (dossier) bagi tim penilai manusia (human assessor). Tidak ada keputusan penerimaan kerja yang diambil secara otomatis semata-mata oleh sistem AI (Pasal 10 UU PDP).
              </li>
              <li>
                <strong>Retensi & Hak Subjek Data:</strong> Data rekaman dan transkripsi disimpan selama siklus rekrutmen dan dilindungi dari akses pihak ketiga yang tidak berwenang. Anda berhak mengajukan penolakan atau penghapusan data melalui perekrut Anda.
              </li>
            </ul>
          </div>

          <div className="flex items-start gap-2.5 pt-1">
            <input
              type="checkbox"
              id="uu-pdp-affirmative-consent"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
            <label
              htmlFor="uu-pdp-affirmative-consent"
              className="text-xs text-foreground font-medium cursor-pointer select-none"
            >
              Saya secara sadar dan sukarela memberikan persetujuan eksplisit (affirmative consent) atas pemrosesan data biometrik suara dan transkripsi wawancara sesuai ketentuan UU PDP No. 27/2022.
            </label>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2">
          {onDecline && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDecline}
            >
              Tolak / Decline
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={!agreed}
            onClick={onConsent}
            className="ml-auto"
          >
            Saya Setuju
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PreFlightConsentModal;
