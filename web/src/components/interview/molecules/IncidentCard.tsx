import React, { useState } from "react";
import { AlertCircle, Copy, Check, RotateCcw, Mail, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface IncidentCardProps {
  token?: string;
  sessionId?: number | string;
  onRetry?: () => void;
  canRetry?: boolean;
  className?: string;
}

export function IncidentCard({
  token,
  sessionId,
  onRetry,
  canRetry = true,
  className,
}: IncidentCardProps) {
  const [copied, setCopied] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);

  const referenceId = token || (sessionId ? `SES-${sessionId}` : "N/A");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referenceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      data-testid="incident-card"
      className={cn(
        "max-w-xl mx-auto px-6 py-8 my-6 bg-white border border-amber-200 rounded-xl shadow-sm text-left space-y-6",
        className
      )}
    >
      {/* Incident Header */}
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-600 shrink-0">
          <AlertCircle className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">
            Sesi Wawancara Terputus
          </h2>
          <p className="text-sm text-neutral-600 leading-relaxed">
            Koneksi ke sistem kecerdasan buatan terputus karena batas waktu atau kendala jaringan.
          </p>
        </div>
      </div>

      {/* Assurance Note */}
      <div className="p-3.5 rounded-lg bg-neutral-50 border border-neutral-200 text-xs text-neutral-600 leading-normal space-y-1">
        <div className="font-medium text-neutral-800 flex items-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5 text-neutral-500" />
          Jawaban Anda Tetap Aman
        </div>
        <p>
          Seluruh rekaman dan transkrip jawaban yang telah Anda sampaikan sebelum gangguan telah tersimpan secara otomatis di server kami.
        </p>
      </div>

      {/* Session Reference ID Box */}
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
          Reference ID Sesi
        </span>
        <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-100/80 border border-neutral-200 font-mono text-xs text-neutral-800">
          <span className="truncate mr-2 select-all" data-testid="session-reference-text">
            {referenceId}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-8 px-2.5 text-xs gap-1.5 shrink-0 bg-white"
            data-testid="copy-reference-btn"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-700">Tersalin</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-neutral-500" />
                <span>Salin ID</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {canRetry && onRetry && (
          <Button
            type="button"
            onClick={onRetry}
            className="flex-1 gap-2 bg-neutral-900 hover:bg-neutral-800 text-white font-medium"
            data-testid="retry-interview-btn"
          >
            <RotateCcw className="h-4 w-4" />
            Coba Sambungkan Ulang
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowContactInfo(!showContactInfo)}
          className="flex-1 gap-2 border-neutral-300 text-neutral-700 hover:bg-neutral-50"
          data-testid="contact-hiring-btn"
        >
          <Mail className="h-4 w-4 text-neutral-500" />
          Hubungi Tim Hiring
        </Button>
      </div>

      {/* Contact Instructions Drawer / Details */}
      {showContactInfo && (
        <div
          data-testid="contact-info-panel"
          className="p-3.5 rounded-lg bg-blue-50/60 border border-blue-200 text-xs text-neutral-700 space-y-1.5 animate-in fade-in duration-200"
        >
          <p className="font-semibold text-blue-900">Petunjuk Kontak Asesor / Tim Rekrutmen:</p>
          <p>
            Kirimkan email ke alamat tim rekrutmen yang tertera pada surat undangan wawancara Anda, dengan melampirkan <strong>Reference ID</strong> di atas dan perkiraan waktu terjadinya gangguan teknis.
          </p>
        </div>
      )}
    </div>
  );
}

export default IncidentCard;
