import React, { useState } from "react";
import { ShieldCheck, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PrivacyBadgeProps {
  className?: string;
  variant?: "badge" | "banner";
}

export default function PrivacyBadge({ className, variant = "badge" }: PrivacyBadgeProps) {
  const [showInfo, setShowInfo] = useState(false);

  if (variant === "banner") {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-emerald-50/80 p-4 text-emerald-950 shadow-xs dark:from-emerald-950/20 dark:via-teal-950/10 dark:to-emerald-950/20 dark:text-emerald-100",
          className
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-emerald-900 dark:text-emerald-200">
                UU PDP No. 27/2022 Compliant
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                Active Protection
              </span>
            </div>
            <p className="text-xs text-emerald-800/90 leading-relaxed dark:text-emerald-300/90">
              Candidate personal identifiers (NIK, Phone Number, Email) are strictly anonymized via automated sanitization before AI evaluation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        onClick={() => setShowInfo(true)}
        role="button"
        tabIndex={0}
        title="Candidate PII Anonymized under UU PDP No. 27/2022"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-50/90 px-2.5 py-1 text-xs font-medium text-emerald-800 shadow-2xs hover:bg-emerald-100/90 transition-colors cursor-pointer dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/50",
          className
        )}
      >
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        <span>UU PDP Compliant</span>
        <span className="text-[10px] opacity-70">· PII Protected</span>
        <Info className="h-3 w-3 text-emerald-600/70 ml-0.5" />
      </div>

      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl border bg-background p-6 shadow-xl">
            <button
              onClick={() => setShowInfo(false)}
              className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5 text-emerald-600 mb-3">
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">UU PDP No. 27/2022 Protection</h3>
                <p className="text-xs text-muted-foreground">Indonesian Personal Data Protection Law</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              To adhere to the Indonesian Data Protection Law (Undang-Undang Perlindungan Data Pribadi No. 27/2022), all candidate submissions are pre-processed through automated PII filters prior to Google Gemini AI API transmission:
            </p>
            <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-xs font-mono">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Email Address:</span>
                <span className="text-emerald-600 font-semibold">[ANONYMIZED_EMAIL]</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Phone (+62 / 08xx):</span>
                <span className="text-emerald-600 font-semibold">[ANONYMIZED_PHONE]</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>NIK (16-digit ID):</span>
                <span className="text-emerald-600 font-semibold">[ANONYMIZED_NIK]</span>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowInfo(false)}
                className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
