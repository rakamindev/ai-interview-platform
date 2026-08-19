import { Award, CheckCircle2, ShieldCheck, Mail } from "lucide-react";
import type { Lang } from "@/utils/candidateI18n";
import { candidateTranslations } from "@/utils/candidateI18n";

interface CompleteStepProps {
  lang: Lang;
  candidateName?: string;
  roleTitle?: string;
}

export function CompleteStep({ lang, candidateName, roleTitle }: CompleteStepProps) {
  const t = candidateTranslations[lang].complete;

  return (
    <div className="max-w-lg mx-auto py-8 px-4 text-center space-y-6 animate-in zoom-in-95 duration-400">
      {/* Icon Badge */}
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-lg">
        <Award className="h-10 w-10" />
      </div>

      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        {roleTitle && (
          <p className="text-xs font-semibold text-primary">{roleTitle} · {candidateName || "Candidate"}</p>
        )}
      </div>

      {/* Confirmation & Next Steps Card */}
      <div className="bg-card border rounded-2xl p-6 text-left space-y-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>{t.recordedNotice}</span>
        </div>

        <div className="space-y-2.5 pt-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-primary" />
            {t.nextStepsTitle}
          </h4>
          <ul className="space-y-2 text-xs text-muted-foreground leading-relaxed">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>{t.nextStep1}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>{t.nextStep2}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>{t.nextStep3}</span>
            </li>
          </ul>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{t.closeTabNotice}</p>
    </div>
  );
}
