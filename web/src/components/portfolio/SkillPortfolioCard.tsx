import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap, MinusCircle, AlertTriangle, UserCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved: (override: AssessorOverride) => void;
}

const UNASSESSED_COPY = {
  not_assessed: {
    icon: MinusCircle,
    label: "Belum Diuji",
    detail: "Skill ini dikonfigurasi pada asesmen namun belum sempat diuji selama sesi wawancara.",
    classes: "border-dashed text-muted-foreground",
    iconClasses: "text-muted-foreground",
  },
  unparseable: {
    icon: AlertTriangle,
    label: "Perlu Peninjauan Manual",
    detail: "Hasil respon untuk skill ini belum dapat diskor otomatis dan membutuhkan peninjauan manual.",
    classes: "border-amber-300",
    iconClasses: "text-amber-600",
  },
} as const;

/** Rendered for a skill that has no real AI level to show — never crash on a null level, never fake one. */
function UnassessedSkillCard({ skill, status }: { skill: PortfolioSkill; status: "not_assessed" | "unparseable" }) {
  const copy = UNASSESSED_COPY[status];
  const Icon = copy.icon;

  return (
    <Card className={copy.classes} data-testid="unassessed-skill-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", copy.iconClasses)} aria-hidden="true" />
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold">{skill.skill_label}</span>
              {skill.is_discovered && (
                <span className="flex items-center gap-0.5 text-xs text-amber-600">
                  <Zap className="h-3 w-3" /> Discovered
                </span>
              )}
            </div>
            <span className={cn("text-xs font-medium", copy.iconClasses)}>{copy.label}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {skill.competency_summary || copy.detail}
        </p>
      </CardContent>
    </Card>
  );
}

export default function SkillPortfolioCard({
  skill,
  override,
  onOverrideSaved,
}: SkillPortfolioCardProps) {
  if (skill.status !== "assessed") {
    return <UnassessedSkillCard skill={skill} status={skill.status} />;
  }

  const parsedLevel = parseLevel(skill.ai_level);
  if (parsedLevel === null) {
    // Defensive: backend marked this "assessed" but sent no usable level.
    // Treat it the same as unparseable rather than crash (null.replace in
    // the old parseLevel) or silently render it as L1.
    return <UnassessedSkillCard skill={skill} status="unparseable" />;
  }

  const effectiveLevel = override?.override_level ?? parsedLevel;
  // Narrowed copy: ai_level/ai_confidence are guaranteed non-null here (we
  // just checked status === "assessed" and parsedLevel !== null above), so
  // downstream components that only make sense for an assessed skill
  // (confidence indicator, override panel) get real types instead of
  // `| null` — no `?? 1`-style fallback needed anywhere below.
  const assessedSkill = { ...skill, ai_level: parsedLevel, ai_confidence: skill.ai_confidence ?? "low" };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Skill header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <LevelBadge level={effectiveLevel} />
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-600">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}
              </div>
              <ConfidenceIndicator confidence={assessedSkill.ai_confidence} />
            </div>
          </div>
          <OverridePanel skill={assessedSkill} existingOverride={override} onSaved={onOverrideSaved} />
        </div>

        {/* Assessor Override Audit Box */}
        {override && (
          <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3 space-y-1.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-indigo-950">
                <UserCheck className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>
                  Penyesuaian Manual Assessor: Level {parseLevel(skill.ai_level)} (AI) ➔ Level {override.override_level}
                </span>
              </div>
              {override.overridden_at && (
                <span className="text-[11px] text-indigo-600 font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(override.overridden_at).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
            {override.assessor_notes && (
              <div className="text-slate-700 bg-white/90 rounded-lg p-2.5 border border-indigo-100/80 mt-1 leading-relaxed shadow-2xs">
                <span className="font-bold text-slate-900 block text-[11px] mb-0.5">Catatan Assessor:</span>
                "{override.assessor_notes}"
              </div>
            )}
          </div>
        )}

        {/* Low confidence note */}
        {assessedSkill.ai_confidence.toLowerCase() === "low" && (
          <div className="text-xs text-amber-800 bg-amber-50/80 border border-amber-200/80 rounded-xl px-3 py-2 leading-relaxed">
            Eksplorasi singkat. Tingkat keyakinan AI masih rendah — disarankan konfirmasi lebih lanjut jika skill ini kritikal bagi posisi.
          </div>
        )}

        {/* Evidence */}
        {skill.evidence.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              Bukti Kutipan Wawancara
            </span>
            <ul className="space-y-1.5">
              {skill.evidence.map((quote, i) => (
                <li key={i} className="text-xs sm:text-sm text-slate-800 bg-slate-50/60 rounded-lg p-2 border border-slate-200/60 leading-relaxed italic">
                  "{quote}"
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Competency summary */}
        {skill.competency_summary && (
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Ringkasan Kompetensi AI
            </span>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {skill.competency_summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
