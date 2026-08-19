import { useState } from "react";
import HardwareCheck from "@/components/HardwareCheck";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mic, Sparkles } from "lucide-react";
import type { Lang } from "@/utils/candidateI18n";
import { candidateTranslations } from "@/utils/candidateI18n";

interface DeviceCheckStepProps {
  lang: Lang;
  onReady: () => void;
  onBack: () => void;
}

export function DeviceCheckStep({ lang, onReady, onBack }: DeviceCheckStepProps) {
  const [passed, setPassed] = useState(false);
  const t = candidateTranslations[lang].deviceCheck;

  return (
    <div className="max-w-xl mx-auto space-y-5 animate-in fade-in-50 duration-300">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-foreground">{t.title}</h2>
        <p className="text-xs text-muted-foreground">{t.subtitle}</p>
      </div>

      <div className="bg-card border rounded-2xl p-5 shadow-xs space-y-4">
        <HardwareCheck onPassedChange={setPassed} />

        {passed && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{t.passedBanner}</span>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button variant="outline" size="lg" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            {t.backBtn}
          </Button>

          <Button
            size="lg"
            className="flex-1"
            disabled={!passed}
            onClick={onReady}
          >
            <Mic className="h-4 w-4 mr-2" />
            {t.readyBtn}
          </Button>
        </div>
      </div>
    </div>
  );
}
