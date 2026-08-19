import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Lock, UserCheck, Globe } from "lucide-react";

interface ConsentModalProps {
  open: boolean;
  onConsent: (locale: string) => void;
  loading?: boolean;
}

export default function ConsentModal({ open, onConsent, loading = false }: ConsentModalProps) {
  const [locale, setLocale] = useState<"id" | "en">("id");
  const [agreed, setAgreed] = useState(false);

  const isId = locale === "id";

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-xl p-6">
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wide uppercase">
              <ShieldCheck className="h-4 w-4" />
              {isId ? "Kepatuhan UU PDP No. 27/2022" : "UU PDP Data Privacy Compliance"}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs flex items-center gap-1"
              onClick={() => setLocale(isId ? "en" : "id")}
            >
              <Globe className="h-3.5 w-3.5" />
              {isId ? "English" : "Bahasa Indonesia"}
            </Button>
          </div>
          <DialogTitle className="text-xl font-bold">
            {isId
              ? "Persetujuan Pemrosesan Suara & Evaluasi AI"
              : "Voice Processing & AI Evaluation Consent"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {isId
              ? "Harap baca dan setujui ketentuan privasi sebelum memulai wawancara audio."
              : "Please review and accept our privacy terms before starting your audio interview."}
          </DialogDescription>
        </DialogHeader>

        <div className="my-3 space-y-3 bg-muted/40 p-4 rounded-lg border text-xs leading-relaxed text-muted-foreground">
          <div className="flex items-start gap-2.5">
            <Lock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">
                {isId ? "Perekaman Suara Real-time: " : "Real-time Voice Audio: "}
              </span>
              {isId
                ? "Sesi ini akan menangkap audio mikrofon Anda secara aman untuk dianalisis oleh AI Interviewer Gemini. Audio diproses secara terenkripsi dan tidak disebarluaskan ke pihak ketiga tanpa izin."
                : "This session captures your microphone audio securely for Gemini AI analysis. Streams are encrypted and never shared with unauthorized third parties."}
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <UserCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">
                {isId ? "Jaminan Peninjauan Manusia (Human-in-the-Loop): " : "Human Assessor Review: "}
              </span>
              {isId
                ? "Hasil analisis AI bukan merupakan keputusan mutlak. Seluruh transkrip dan bukti kutipan akan ditinjau serta dapat disesuaikan (override) oleh tim rekruter manusia."
                : "AI analysis is not a sole automated decision. All transcripts and evidence quotes are reviewed and subject to human recruiter overrides."}
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">
                {isId ? "Hak Perlindungan Data Pribadi: " : "Personal Data Rights: "}
              </span>
              {isId
                ? "Sesuai UU PDP No. 27/2022, data Anda disimpan secara terbatas untuk proses rekrutmen ini dan Anda berhak meminta penghapusan riwayat data setelah proses seleksi selesai."
                : "In accordance with Indonesian UU PDP, your data is retained solely for this hiring cycle, with rights to access or request deletion."}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <input
            id="pdp-consent-checkbox"
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
          />
          <label htmlFor="pdp-consent-checkbox" className="text-xs text-foreground cursor-pointer select-none">
            {isId
              ? "Saya telah membaca, memahami, dan memberikan persetujuan eksplisit untuk pemrosesan data audio & transkrip wawancara ini."
              : "I have read, understood, and grant explicit consent for the processing of my audio data and interview transcripts."}
          </label>
        </div>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={!agreed || loading}
            onClick={() => onConsent(locale)}
          >
            {loading
              ? isId ? "Menyimpan..." : "Saving..."
              : isId ? "Setuju & Lanjutkan ke Pemeriksaan Perangkat" : "Agree & Proceed to Hardware Check"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
