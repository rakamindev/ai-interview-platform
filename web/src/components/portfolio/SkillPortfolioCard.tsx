import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap, Quote, AlertTriangle } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved: (override: AssessorOverride) => void;
}

export default function SkillPortfolioCard({
  skill,
  override,
  onOverrideSaved,
}: SkillPortfolioCardProps) {
  const effectiveLevel = override?.override_level ?? parseLevel(skill.ai_level);
  const isUnassessed = effectiveLevel === null;

  return (
    <Card className="border border-border/80 bg-card shadow-sm hover:border-primary/40 hover:shadow-md transition-all rounded-2xl">
      <CardContent className="p-5 space-y-4">
        {/* Skill header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5">
            <LevelBadge level={effectiveLevel} />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-foreground text-sm sm:text-base tracking-tight">
                  {skill.skill_label}
                </span>
                {skill.is_discovered && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}
                {override && (
                  <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-300">
                    Overridden by Assessor
                  </span>
                )}
              </div>
              <ConfidenceIndicator confidence={skill.ai_confidence} />
            </div>
          </div>
          <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
        </div>

        {/* Low confidence / Unassessed note */}
        {isUnassessed ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 border border-border/60 rounded-xl px-3.5 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <span>Keahlian ini belum dievaluasi secara mendalam selama wawancara berlangsung.</span>
          </div>
        ) : skill.ai_confidence?.toLowerCase() === "low" ? (
          <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3.5 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <span>Hanya dieksplorasi singkat. Tingkat keyakinan rendah, disarankan konfirmasi tambahan jika keahlian ini krusial.</span>
          </div>
        ) : null}

        {/* Evidence */}
        {skill.evidence && skill.evidence.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Quote className="h-3.5 w-3.5 text-primary" />
              <span>Kutipan Bukti Percakapan Kandidat</span>
            </div>
            <div className="space-y-2">
              {skill.evidence.map((quote, i) => (
                <div
                  key={i}
                  className="text-xs text-foreground bg-muted/40 border border-border/70 rounded-xl px-3.5 py-2.5 italic border-l-2 border-l-primary/80"
                >
                  "{quote}"
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Competency summary */}
        {skill.competency_summary && (
          <div className="space-y-1.5 pt-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Ringkasan Analisis Kompetensi AI
            </span>
            <p className="text-xs text-foreground/90 leading-relaxed bg-muted/30 p-3 rounded-xl border border-border/60">
              {skill.competency_summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
