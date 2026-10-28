import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ClampText } from "@/components/ui/clamp-text";
import { LevelSourceMarker } from "@/components/ui/level-source-marker";
import type { PortfolioSkill, SkillComparison } from "@/types";

interface SkillEvidenceProps {
  comparison: SkillComparison;
  skill: PortfolioSkill | undefined;
}

function SubHeading({ children }: { children: string }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">{children}</h3>;
}

// Evidence quotes, summary and the assessor review behind one comparison row.
export default function SkillEvidence({ comparison, skill }: SkillEvidenceProps) {
  if (!skill) {
    return <p className="text-xs text-muted-foreground">No interview evidence for this skill yet.</p>;
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="evidence" className="border-b-0">
        <AccordionTrigger className="justify-start gap-1 rounded-sm py-1 text-xs text-teal-800 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span>
            Evidence and review <span className="sr-only">for {comparison.skill_label}</span>
          </span>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pt-2">
          <div className="space-y-2">
            <SubHeading>Evidence from the interview</SubHeading>
            {skill.evidence.length > 0 ? (
              <ul className="space-y-2">
                {skill.evidence.map((quote, index) => (
                  <li key={index} className="border-l-2 pl-3 text-sm">
                    <ClampText text={quote} lines={3} maxChars={300} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No quotes were recorded for this skill.</p>
            )}
          </div>
          {skill.competency_summary && (
            <div className="space-y-2">
              <SubHeading>Summary</SubHeading>
              <ClampText text={skill.competency_summary} className="text-sm" />
            </div>
          )}
          <div className="space-y-2">
            <SubHeading>Assessor review</SubHeading>
            {comparison.review ? (
              <LevelSourceMarker source={comparison.level_source} aiLevel={comparison.ai_level ?? null}
                                 review={comparison.review} variant="detailed" />
            ) : (
              <p className="text-sm text-muted-foreground">Not reviewed by an assessor yet.</p>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
