import { cn } from "@/lib/utils";
import type { SkillStatus } from "@/types";

// One mark per configured skill, drawn so the four states read apart even in
// grayscale: solid, outlined, dashed, slashed.
const MARK: Record<SkillStatus, string> = {
  assessed: "bg-primary",
  thin_evidence: "bg-background border-[1.5px] border-attention-line",
  not_assessed: "border-[1.5px] border-dashed border-muted-foreground",
  unavailable: "bg-attention-line",
};

const SLASH = {
  backgroundImage: "linear-gradient(135deg, transparent 42%, white 42%, white 58%, transparent 58%)",
};

const WORDS: Array<[SkillStatus, string, string]> = [
  ["thin_evidence", "needs a look", "needs a human look"],
  ["not_assessed", "not assessed", "not assessed"],
  ["unavailable", "couldn't be evaluated", "could not be evaluated"],
];

export function evidenceWords(statuses: SkillStatus[]) {
  const count = (s: SkillStatus) => statuses.filter((x) => x === s).length;
  const rest = WORDS.filter(([s]) => count(s) > 0);
  const short = [`${count("assessed")} of ${statuses.length} assessed`, ...rest.map(([s, w]) => `${count(s)} ${w}`)];
  const long = [`${count("assessed")} assessed`, ...rest.map(([s, , w]) => `${count(s)} ${w}`)];
  return {
    text: short.join(" · "),
    label: `Evidence for ${statuses.length} ${statuses.length === 1 ? "skill" : "skills"}: ${long.join(", ")}`,
  };
}

export default function EvidenceStrip({ statuses }: { statuses: SkillStatus[] }) {
  const small = statuses.length > 14;
  const { text, label } = evidenceWords(statuses);

  return (
    <div className="space-y-1">
      <div role="img" aria-label={label} className="flex flex-wrap gap-0.5">
        {statuses.map((status, i) => (
          <span
            key={i}
            data-evidence-state={status}
            className={cn("rounded-[2px]", small ? "h-2 w-2" : "h-3 w-3", MARK[status])}
            style={status === "unavailable" ? SLASH : undefined}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
