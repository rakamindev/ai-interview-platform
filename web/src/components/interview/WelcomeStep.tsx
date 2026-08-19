import { useState } from "react";
import { Clock, Globe, ShieldCheck, CheckCircle2, ArrowRight, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LEVEL_LABELS } from "@/utils/constants";
import type { CandidateInfo } from "@/types";
import type { Lang } from "@/utils/candidateI18n";
import { candidateTranslations } from "@/utils/candidateI18n";

interface WelcomeStepProps {
  info: CandidateInfo;
  lang: Lang;
  onProceed: () => void;
  onResume: () => void;
}

export function WelcomeStep({ info, lang, onProceed, onResume }: WelcomeStepProps) {
  const [consentChecked, setConsentChecked] = useState(Boolean(info.consent_accepted_at));
  const t = candidateTranslations[lang].welcome;

  const isLive = info.session_status === "active";

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in-50 duration-300">
      {/* Top Banner */}
      <div className="bg-card border rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              AI Voice Assessment
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {info.role_title || "Technical Interview"}
            </h1>
            {info.candidate_name && (
              <p className="text-sm text-muted-foreground">Candidate: <strong className="text-foreground">{info.candidate_name}</strong></p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-xs font-medium">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>{info.time_limit_min} {t.minutes}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-xs font-medium">
              <Globe className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span className="uppercase">{info.language || "en"}</span>
            </div>
          </div>
        </div>

        {/* Resumption notice */}
        {isLive && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-semibold">{t.resumeNotice}</p>
              <Button size="sm" onClick={onResume} className="mt-1">
                {t.resumeBtn}
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Tested Competencies */}
        {info.skills && info.skills.length > 0 && (
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {t.skillsTested}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {info.skills.map((skill, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border text-xs"
                >
                  <span className="font-semibold text-foreground truncate pr-2">{skill.skill_label}</span>
                  <span className="px-2 py-0.5 rounded-md bg-background border font-mono text-[10px] text-muted-foreground shrink-0">
                    L{skill.expected_level} · {LEVEL_LABELS[skill.expected_level]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tips & Instructions */}
        <div className="space-y-2.5 pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t.tipsTitle}
          </h3>
          <ul className="space-y-2 text-xs text-muted-foreground leading-relaxed">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>{t.tip1}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>{t.tip2}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>{t.tip3}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>{t.tip4}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Consent Card */}
      <div className="bg-card border rounded-2xl p-5 shadow-xs space-y-4">
        <label className="flex items-start gap-3.5 cursor-pointer">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary accent-primary"
          />
          <div className="space-y-1">
            <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              {t.consentTitle}
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t.consentBody}
            </p>
          </div>
        </label>

        <Button
          size="lg"
          className="w-full"
          disabled={!consentChecked}
          onClick={onProceed}
        >
          <span>{t.startBtn}</span>
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
