import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Mic, Brain, Lock } from "lucide-react";

interface ConsentNoticeProps {
  roleTitle: string;
  candidateName?: string;
  onConsentGiven: () => void;
  isLoading?: boolean;
}

export default function ConsentNotice({
  roleTitle,
  candidateName,
  onConsentGiven,
  isLoading = false,
}: ConsentNoticeProps) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header Banner */}
      <div className="bg-primary/5 border-b p-5">
        <div className="flex items-center gap-2 text-primary font-medium text-sm mb-1">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span>Regulatory Compliance · Indonesia UU PDP (Law No. 27/2022)</span>
        </div>
        <h2 className="text-lg font-bold text-foreground">
          Candidate Privacy Notice & Consent
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {candidateName ? `Hello ${candidateName}, b` : "B"}efore beginning your AI-assisted interview for the position of{" "}
          <strong className="text-foreground">{roleTitle}</strong>, please review your personal data protection rights and processing terms.
        </p>
      </div>

      {/* Highlights */}
      <div className="p-5 space-y-4">
        <div className="grid gap-3 text-sm">
          <div className="flex gap-3 items-start p-3 rounded-lg bg-muted/40 border">
            <Mic className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">Voice Biometric Audio Recording</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Your spoken voice audio will be captured and streamed in real-time during this session to facilitate two-way conversational interaction.
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-start p-3 rounded-lg bg-muted/40 border">
            <Brain className="h-5 w-5 text-purple-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">AI Transcription & Competency Assessment</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Your conversation will be transcribed and analyzed by an AI model (Google Gemini) to assess role-relevant technical competencies according to standardized skill rubrics.
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-start p-3 rounded-lg bg-muted/40 border">
            <Lock className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">Data Subject Rights & Human Oversight</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                AI evaluations are subject to human assessor review and override (Human-in-the-Loop). In accordance with Indonesia's Personal Data Protection Law (UU PDP No. 27/2022), you retain the right to request access, correction, or deletion of your interview records through the hiring organization.
              </p>
            </div>
          </div>
        </div>

        {/* Consent Checkbox */}
        <div className="pt-2">
          <label className="flex items-start gap-3 p-3.5 rounded-lg border-2 border-primary/20 bg-primary/[0.02] cursor-pointer hover:bg-primary/[0.05] transition-colors">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-xs text-foreground leading-relaxed select-none">
              I have read, understood, and <strong>provide explicit consent</strong> for the recording of my voice audio, AI-driven transcription and competency evaluation, and secure data storage for recruitment purposes pursuant to <strong>Indonesia UU PDP Law No. 27/2022</strong>.
            </span>
          </label>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="px-5 py-4 border-t bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          This consent may be withdrawn at any time prior to starting the interview.
        </span>
        <Button
          onClick={onConsentGiven}
          disabled={!agreed || isLoading}
          size="default"
          className="w-full sm:w-auto"
        >
          {isLoading ? "Recording Consent..." : "Accept & Proceed to Equipment Check"}
        </Button>
      </div>
    </div>
  );
}
