
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import {
  Zap,
  MessageSquareQuote,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
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
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const aiLevel = parseLevel(skill.ai_level);
  const effectiveLevel = override?.override_level ?? aiLevel;
  const hasOverride = override?.override_level != null;
  const isLowConfidence = skill.ai_confidence?.toLowerCase() === "low";

  const evidence = skill.evidence ?? [];
  const visibleEvidence = showAllEvidence
    ? evidence
    : evidence.slice(0, 2);

  const hiddenEvidenceCount = Math.max(0, evidence.length - 2);
  const summary = skill.competency_summary ?? "";
  const shouldCollapseSummary = summary.length > 220;

  return (
    <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm">
      <CardContent className="space-y-6 p-5 sm:p-6">
        {/* Nama skill */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-[#01959f]">
              {skill.is_discovered ? (
                <Zap className="h-5 w-5" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
            </div>

            <div className="min-w-0 space-y-2">
              <h3 className="break-words text-base font-semibold leading-6 text-slate-900">
                {skill.skill_label}
              </h3>

              <div className="flex flex-wrap items-center gap-2">
                <ConfidenceIndicator confidence={skill.ai_confidence} />

                {skill.is_discovered && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                    Skill tambahan
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="self-start">
            <OverridePanel
              skill={skill}
              existingOverride={override}
              onSaved={onOverrideSaved}
            />
          </div>
        </div>

        {/* Level akhir sebagai fokus utama */}
        <section className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-800">
            Level akhir
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <LevelBadge level={effectiveLevel} />

            <div className="min-w-0">
              <p className="font-semibold text-slate-900">
                {hasOverride ? "Disesuaikan reviewer" : "Hasil penilaian AI"}
              </p>

              <p className="mt-1 text-sm leading-5 text-slate-600">
                {hasOverride
                  ? "Level telah diubah oleh reviewer."
                  : "Level berdasarkan analisis AI."}
              </p>
            </div>
          </div>

          {hasOverride && (
            <div className="mt-4 border-t border-teal-200 pt-3">
              <p className="text-sm text-slate-600">
                Level awal AI:{" "}
                <span className="font-medium text-slate-800">
                  <LevelBadge level={aiLevel} />
                </span>
              </p>
            </div>
          )}
        </section>

        {/* Peringatan keyakinan rendah */}
        {isLowConfidence && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-900">
                Bukti penilaian masih terbatas
              </p>
              <p className="text-sm leading-6 text-amber-800">
                Skill ini belum banyak dibahas dalam wawancara. Pertimbangkan
                pertanyaan lanjutan sebelum mengambil keputusan.
              </p>
            </div>
          </div>
        )}

        {/* Bukti wawancara */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquareQuote className="h-5 w-5 text-slate-500" />

            <h4 className="font-semibold text-slate-900">
              Bukti wawancara
            </h4>

            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {evidence.length}
            </span>
          </div>

          {evidence.length > 0 ? (
            <>
              <ul className="space-y-3">
                {visibleEvidence.map((quote, index) => (
                  <li
                    key={`${index}-${quote.slice(0, 24)}`}
                    className="rounded-xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700"
                  >
                    <span className="mr-1 font-semibold text-teal-700">
                      “
                    </span>
                    {quote}
                    <span className="ml-1 font-semibold text-teal-700">
                      ”
                    </span>
                  </li>
                ))}
              </ul>

              {evidence.length > 2 && (
                <button
                  type="button"
                  onClick={() =>
                    setShowAllEvidence((previous) => !previous)
                  }
                  className="inline-flex items-center gap-2 rounded-md py-1 text-sm font-medium text-teal-700 hover:text-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  aria-expanded={showAllEvidence}
                >
                  {showAllEvidence
                    ? "Tampilkan lebih sedikit"
                    : `Lihat semua bukti (${hiddenEvidenceCount} lainnya)`}

                  {showAllEvidence ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              )}
            </>
          ) : (
            <p className="rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-500">
              Belum ada bukti wawancara untuk skill ini.
            </p>
          )}
        </section>

        {/* Ringkasan kompetensi yang dapat dibuka */}
        {summary && (
          <section className="border-t border-slate-100 pt-5">
            <h4 className="font-semibold text-slate-900">
              Ringkasan kompetensi
            </h4>

            <p className="mt-3 text-sm leading-7 text-slate-600">
              {shouldCollapseSummary && !showSummary
                ? `${summary.slice(0, 220).trimEnd()}…`
                : summary}
            </p>

            {shouldCollapseSummary && (
              <button
                type="button"
                onClick={() => setShowSummary((previous) => !previous)}
                className="mt-3 inline-flex items-center gap-2 rounded-md py-1 text-sm font-medium text-teal-700 hover:text-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                aria-expanded={showSummary}
              >
                {showSummary ? "Ringkas kembali" : "Baca selengkapnya"}

                {showSummary ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  );
}
