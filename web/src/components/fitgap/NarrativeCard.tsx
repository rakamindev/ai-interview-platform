import { useState } from "react";
import { FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FitGapReport } from "@/types";

const COLLAPSE_AFTER_CHARS = 600;

interface NarrativeCardProps {
  report: Pick<FitGapReport, "narrative_source" | "overall_narrative" | "culture_narrative">;
}

export default function NarrativeCard({ report }: NarrativeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const sections = [
    { title: "Overall", body: report.overall_narrative },
    { title: "Culture & competency", body: report.culture_narrative },
  ].filter((s): s is { title: string; body: string } => Boolean(s.body?.trim()));

  if (sections.length === 0) return null;

  const isAi = report.narrative_source === "ai";
  const long = sections.reduce((n, s) => n + s.body.length, 0) > COLLAPSE_AFTER_CHARS;
  const collapsed = long && !expanded;

  return (
    <section aria-labelledby="fitgap-narrative-title" className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="fitgap-narrative-title" className="text-sm font-semibold">
          Summary
        </h2>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
            isAi ? "bg-sky-50 text-sky-700 ring-sky-600/20" : "bg-slate-50 text-slate-600 ring-slate-400/30"
          )}
        >
          {isAi ? <Sparkles className="h-3 w-3" aria-hidden /> : <FileText className="h-3 w-3" aria-hidden />}
          {isAi ? "AI-generated draft" : "Automatic summary"}
        </span>
      </div>

      <div className={cn("relative space-y-3", collapsed && "max-h-40 overflow-hidden")}>
        {sections.map((s) => (
          <div key={s.title} className="space-y-1">
            {sections.length > 1 && (
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.title}</h3>
            )}
            <p className="whitespace-pre-line break-words text-sm leading-relaxed">{s.body}</p>
          </div>
        ))}
        {collapsed && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent" />
        )}
      </div>

      {long && (
        <Button variant="link" size="sm" className="mt-1 h-auto px-0" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less" : "Read more"}
        </Button>
      )}

      <p className="mt-3 border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
        {isAi
          ? "Written by AI from the rule-based comparison above. Verify before using it in a hiring decision."
          : "The AI narrative was unavailable, so this summary was generated from the comparison rules."}
      </p>
    </section>
  );
}
