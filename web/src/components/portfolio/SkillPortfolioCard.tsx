import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap, ChevronDown, ChevronUp, UserCheck, Quote } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";
import { motion, AnimatePresence } from "framer-motion";

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
  const [showAllQuotes, setShowAllQuotes] = useState(false);
  const effectiveLevel = override?.override_level ?? parseLevel(skill.ai_level);
  const rawEvidence = skill.evidence || [];
  const quotes: string[] = rawEvidence.map((e: any) =>
    typeof e === "string" ? e : (e?.quote ?? String(e))
  );

  return (
    <Card className="transition-all hover:shadow-xs border border-border/80 bg-white">
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <LevelBadge level={effectiveLevel} />
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground text-base">
                  {skill.skill_label}
                </span>
                {skill.is_discovered && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    <Zap className="h-3 w-3 fill-amber-500 text-amber-500" /> Discovered Skill
                  </span>
                )}
                {override && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#01808a] bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                    <UserCheck className="h-3 w-3 text-[#01959f]" />
                    You Overridden ✓ (Overridden: L{override.override_level}) (AI: L{parseLevel(skill.ai_level)})
                  </span>
                )}
              </div>
              <ConfidenceIndicator confidence={skill.ai_confidence} />
            </div>
          </div>
          <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
        </div>

        {/* Human override note banner */}
        {override?.assessor_notes && (
          <div className="text-xs bg-teal-50/70 border border-teal-200/80 rounded-xl p-3 text-slate-800 space-y-1">
            <span className="font-semibold flex items-center gap-1.5 text-[#01959f]">
              <UserCheck className="h-3.5 w-3.5" /> Catatan Penilai (Assessor Rationale):
            </span>
            <p className="italic text-slate-700 pl-5">{override.assessor_notes}</p>
          </div>
        )}

        {/* Low confidence advisory */}
        {skill.ai_confidence?.toLowerCase() === "low" && !override && (
          <div className="text-xs text-amber-800 bg-amber-50/80 border border-amber-200 rounded-xl p-3">
            Hanya dieksplorasi secara singkat selama sesi wawancara. Tingkat keyakinan AI rendah — disarankan konfirmasi teknis mendalam sebelum keputusan final.
          </div>
        )}

        {/* Evidence section */}
        {quotes.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Quote className="h-3 w-3" /> Interview Evidence Quotes ({quotes.length})
              </span>
              {quotes.length > 2 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllQuotes(!showAllQuotes)}
                  className="h-6 px-2 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  {showAllQuotes ? (
                    <>
                      Show less <ChevronUp className="h-3 w-3 ml-1" />
                    </>
                  ) : (
                    <>
                      Show all ({quotes.length}) <ChevronDown className="h-3 w-3 ml-1" />
                    </>
                  )}
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {quotes.slice(0, 2).map((quote, i) => (
                <div
                  key={i}
                  className="text-xs sm:text-sm text-foreground/90 pl-3 border-l-2 border-primary/40 bg-muted/20 py-2 pr-2.5 rounded-r"
                >
                  &ldquo;{quote}&rdquo;
                </div>
              ))}

              <AnimatePresence initial={false}>
                {showAllQuotes && (
                  <motion.div
                    key="extra-quotes"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.28, ease: "easeInOut" }}
                    className="overflow-hidden space-y-2"
                  >
                    {quotes.slice(2).map((quote, i) => (
                      <motion.div
                        key={i + 2}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2, delay: i * 0.04 }}
                        className="text-xs sm:text-sm text-foreground/90 pl-3 border-l-2 border-primary/40 bg-muted/20 py-2 pr-2.5 rounded-r"
                      >
                        &ldquo;{quote}&rdquo;
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Competency summary */}
        {skill.competency_summary && (
          <div className="space-y-1 pt-1 border-t border-border/60">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Competency Synthesis
            </span>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {skill.competency_summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
