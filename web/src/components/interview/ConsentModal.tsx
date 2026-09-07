import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Bot,
  Clock,
  Trash2,
  Lock,
  Check,
} from "lucide-react";

interface ConsentModalProps {
  roleTitle?: string;
  onConsent: () => void;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({
  roleTitle,
  onConsent,
}) => {
  const [agreedToAI, setAgreedToAI] = useState(false);
  const [agreedToRetention, setAgreedToRetention] = useState(false);

  const canProceed = agreedToAI && agreedToRetention;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-card text-card-foreground border shadow-2xl rounded-2xl max-w-xl w-full p-6 md:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200 my-auto">
        {/* Header */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <ShieldCheck className="h-4 w-4" />
            Privacy Notice & Data Processing Consent
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">
            Before Starting Your AI Interview
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground">
            This interview for the{" "}
            <span className="font-semibold text-foreground">
              {roleTitle || "Candidate"}
            </span>{" "}
            position uses an AI-powered voice assistant. Please review and agree
            to the following data processing terms before granting microphone and
            hardware permissions.
          </p>
        </div>

        {/* Core Consent Points */}
        <div className="space-y-3.5 text-xs md:text-sm">
          {/* Point 1: Third-party LLM AI Processing */}
          <div className="p-3.5 rounded-xl border bg-muted/30 flex gap-3 items-start">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 shrink-0 mt-0.5">
              <Bot className="h-4 w-4" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                Voice & Speech Processing by Third-Party AI (LLM)
              </div>
              <p className="text-muted-foreground leading-relaxed text-xs">
                Your audio stream, spoken responses, and real-time transcripts
                will be processed by third-party artificial intelligence models
                (Google Gemini AI / LLM) for competency assessment, dynamic
                follow-up questions, and structured evaluation.
              </p>
            </div>
          </div>

          {/* Point 2: Data Retention Period */}
          <div className="p-3.5 rounded-xl border bg-muted/30 flex gap-3 items-start">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 shrink-0 mt-0.5">
              <Clock className="h-4 w-4" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                Data Retention Period
              </div>
              <p className="text-muted-foreground leading-relaxed text-xs">
                Audio recordings, transcripts, and evaluation scorecards are
                securely stored and encrypted on our servers for up to{" "}
                <span className="font-semibold text-foreground">30 days</span>{" "}
                during the recruitment evaluation cycle, after which data is
                permanently purged or archived.
              </p>
            </div>
          </div>

          {/* Point 3: Right to Erasure / Forgotten */}
          <div className="p-3.5 rounded-xl border bg-muted/30 flex gap-3 items-start">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0 mt-0.5">
              <Trash2 className="h-4 w-4" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                Right to Erasure / Right to be Forgotten
              </div>
              <p className="text-muted-foreground leading-relaxed text-xs">
                You have the right to request access, withdraw consent, or request
                permanent deletion of your personal identity, audio recordings, and
                transcript data at any time by contacting our Privacy & Recruitment
                team at{" "}
                <a
                  href="mailto:privacy@company.com"
                  className="font-medium text-primary underline underline-offset-2"
                >
                  privacy@company.com
                </a>{" "}
                or HR Support.
              </p>
            </div>
          </div>
        </div>

        {/* Checkbox Section */}
        <div className="space-y-3 pt-2 border-t text-xs">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <div
              className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                agreedToAI
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-input bg-background"
              }`}
              onClick={() => setAgreedToAI(!agreedToAI)}
            >
              {agreedToAI && <Check className="h-3.5 w-3.5" />}
            </div>
            <span
              className="text-muted-foreground leading-tight"
              onClick={() => setAgreedToAI(!agreedToAI)}
            >
              I consent to voice recording and response transcription processing
              by third-party AI models for interview evaluation purposes.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <div
              className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                agreedToRetention
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-input bg-background"
              }`}
              onClick={() => setAgreedToRetention(!agreedToRetention)}
            >
              {agreedToRetention && <Check className="h-3.5 w-3.5" />}
            </div>
            <span
              className="text-muted-foreground leading-tight"
              onClick={() => setAgreedToRetention(!agreedToRetention)}
            >
              I acknowledge the 30-day data retention policy and my right to
              request data erasure at any time.
            </span>
          </label>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            <span>Secure connection & encrypted data</span>
          </div>

          <Button
            size="default"
            className="w-full sm:w-auto font-medium"
            disabled={!canProceed}
            onClick={onConsent}
          >
            I Agree & Proceed to Hardware Check
          </Button>
        </div>
      </div>
    </div>
  );
};
