import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LEVEL_LABELS } from "@/utils/constants";
import type { AssessmentRubricVersion, AssessmentRubricVersionSkill } from "@/types";

interface ValueChange {
  label: string;
  before: string;
  after: string;
}

interface SkillChange {
  key: string;
  type: "added" | "removed" | "changed";
  name: string;
  changes: ValueChange[];
}

export interface RubricVersionComparison {
  settings: ValueChange[];
  skills: SkillChange[];
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  id: "Bahasa Indonesia",
};

const SKILL_FIELDS: Array<[keyof AssessmentRubricVersionSkill, string]> = [
  ["skill_label", "Skill name"],
  ["expected_level", "Expected level"],
  ["display_order", "Interview order"],
  ["is_custom", "Skill source"],
  ["scope_include", "Scope included"],
  ["scope_exclude", "Scope excluded"],
  ["l1_anchor", "L1 anchor"],
  ["l2_anchor", "L2 anchor"],
  ["l3_anchor", "L3 anchor"],
  ["l4_anchor", "L4 anchor"],
  ["l5_anchor", "L5 anchor"],
];

function skillKey(skill: AssessmentRubricVersionSkill) {
  return skill.skill_id == null || skill.skill_id === ""
    ? `label:${skill.skill_label.trim().toLocaleLowerCase()}`
    : `id:${skill.skill_id}`;
}

function displaySkillValue(field: keyof AssessmentRubricVersionSkill, value: unknown) {
  if (field === "expected_level") return LEVEL_LABELS[Number(value)] ?? `L${value}`;
  if (field === "display_order") return `Position ${Number(value) + 1}`;
  if (field === "is_custom") return value ? "Custom skill" : "Taxonomy skill";
  return String(value ?? "Not set");
}

function skillChanges(before: AssessmentRubricVersionSkill, after: AssessmentRubricVersionSkill) {
  return SKILL_FIELDS.flatMap(([field, label]) => {
    const beforeValue = displaySkillValue(field, before[field]);
    const afterValue = displaySkillValue(field, after[field]);
    return beforeValue === afterValue ? [] : [{ label, before: beforeValue, after: afterValue }];
  });
}

export function compareRubricVersions(
  before: AssessmentRubricVersion,
  after: AssessmentRubricVersion
): RubricVersionComparison {
  const settings: ValueChange[] = [
    ["Role title", before.name, after.name],
    ["Time limit", `${before.time_limit_min} min`, `${after.time_limit_min} min`],
    ["Interview language", LANGUAGE_LABELS[before.language] ?? before.language, LANGUAGE_LABELS[after.language] ?? after.language],
  ].flatMap(([label, beforeValue, afterValue]) =>
    beforeValue === afterValue ? [] : [{ label, before: beforeValue, after: afterValue }]
  );

  const beforeSkills = new Map(before.skills.map((skill) => [skillKey(skill), skill]));
  const afterSkills = new Map(after.skills.map((skill) => [skillKey(skill), skill]));
  const orderedKeys = [
    ...after.skills.map(skillKey),
    ...before.skills.map(skillKey).filter((key) => !afterSkills.has(key)),
  ];

  const skills: SkillChange[] = [];
  orderedKeys.forEach((key) => {
    const previous = beforeSkills.get(key);
    const next = afterSkills.get(key);

    if (!previous && next) {
      skills.push({ key, type: "added", name: next.skill_label, changes: [] });
      return;
    }
    if (previous && !next) {
      skills.push({ key, type: "removed", name: previous.skill_label, changes: [] });
      return;
    }

    const changes = skillChanges(previous!, next!);
    if (changes.length > 0) {
      skills.push({ key, type: "changed", name: next!.skill_label, changes });
    }
  });

  return { settings, skills };
}

function VersionSelect({
  label,
  value,
  versions,
  onChange,
}: {
  label: string;
  value: number | null;
  versions: AssessmentRubricVersion[];
  onChange: (version: number) => void;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <select
        aria-label={label}
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
        value={value ?? ""}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {versions.map((version) => (
          <option key={version.id} value={version.rubric_version}>
            Rubric v{version.rubric_version}
          </option>
        ))}
      </select>
    </label>
  );
}

function ChangeValues({ changes }: { changes: ValueChange[] }) {
  return (
    <dl className="space-y-2">
      {changes.map((change) => (
        <div key={change.label} className="grid gap-1 text-xs sm:grid-cols-[8rem_1fr_1fr] sm:gap-2">
          <dt className="font-medium text-muted-foreground">{change.label}</dt>
          <dd className="whitespace-pre-wrap break-words rounded bg-muted/50 px-2 py-1 text-muted-foreground">
            {change.before}
          </dd>
          <dd className="whitespace-pre-wrap break-words rounded bg-primary/10 px-2 py-1 text-foreground">
            {change.after}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function RubricDetails({ version }: { version: AssessmentRubricVersion }) {
  return (
    <section className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Only rubric v{version.rubric_version} has been captured so far. These are the criteria used for its candidate sessions.
      </p>
      <div className="rounded-md border p-3 text-sm space-y-1">
        <p><span className="text-muted-foreground">Role:</span> {version.name}</p>
        <p><span className="text-muted-foreground">Time limit:</span> {version.time_limit_min} min</p>
        <p><span className="text-muted-foreground">Interview language:</span> {LANGUAGE_LABELS[version.language] ?? version.language}</p>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Skills and evaluation anchors</h3>
        {version.skills.map((skill) => (
          <article key={skillKey(skill)} className="rounded-md border p-3 space-y-1 text-sm">
            <p className="font-medium">{skill.skill_label} <span className="font-normal text-muted-foreground">({LEVEL_LABELS[skill.expected_level]})</span></p>
            {(["l1_anchor", "l2_anchor", "l3_anchor", "l4_anchor", "l5_anchor"] as const).map((anchor) => (
              <p key={anchor} className="text-xs text-muted-foreground whitespace-pre-wrap">
                {anchor.slice(0, 2).toUpperCase()}: {skill[anchor]}
              </p>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}

export default function RubricVersionComparisonDialog({
  open,
  onOpenChange,
  versions,
  initialVersion,
  loading,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: AssessmentRubricVersion[];
  initialVersion?: number;
  loading?: boolean;
  error?: string | null;
}) {
  const [beforeVersion, setBeforeVersion] = useState<number | null>(null);
  const [afterVersion, setAfterVersion] = useState<number | null>(null);

  useEffect(() => {
    if (!open || versions.length === 0) return;

    const chronologicalVersions = [...versions].sort((a, b) => a.rubric_version - b.rubric_version);
    const target = versions.find((version) => version.rubric_version === initialVersion)
      ?? chronologicalVersions[chronologicalVersions.length - 1];
    const targetIndex = chronologicalVersions.findIndex((version) => version.id === target.id);
    const previous = chronologicalVersions[Math.max(targetIndex - 1, 0)];
    const next = chronologicalVersions[Math.min(targetIndex + 1, chronologicalVersions.length - 1)];

    setBeforeVersion(targetIndex === 0 ? target.rubric_version : previous.rubric_version);
    setAfterVersion(targetIndex === 0 ? next.rubric_version : target.rubric_version);
  }, [open, initialVersion, versions]);

  const before = versions.find((version) => version.rubric_version === beforeVersion);
  const after = versions.find((version) => version.rubric_version === afterVersion);
  const comparison = useMemo(
    () => before && after ? compareRubricVersions(before, after) : null,
    [before, after]
  );
  const hasChanges = comparison && (comparison.settings.length > 0 || comparison.skills.length > 0);

  const selectEarlierVersion = (version: number) => {
    if (version === afterVersion) return;
    if (afterVersion != null && version > afterVersion) {
      setBeforeVersion(afterVersion);
      setAfterVersion(version);
      return;
    }
    setBeforeVersion(version);
  };

  const selectLaterVersion = (version: number) => {
    if (version === beforeVersion) return;
    if (beforeVersion != null && version < beforeVersion) {
      setBeforeVersion(version);
      setAfterVersion(beforeVersion);
      return;
    }
    setAfterVersion(version);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compare captured rubrics</DialogTitle>
          <DialogDescription>
            Compare the exact criteria used for candidate sessions. Draft template changes are not shown here.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading captured rubrics…</p>
        ) : error ? (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No candidate invitations have captured a rubric yet.</p>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <VersionSelect label="Earlier rubric" value={beforeVersion} versions={versions} onChange={selectEarlierVersion} />
              <VersionSelect label="Later rubric" value={afterVersion} versions={versions} onChange={selectLaterVersion} />
            </div>

            {before && after && (
              <div className="grid grid-cols-[8rem_1fr_1fr] gap-2 text-xs text-muted-foreground">
                <span />
                <span>Rubric v{before.rubric_version}</span>
                <span>Rubric v{after.rubric_version}</span>
              </div>
            )}

            {versions.length === 1 && after ? (
              <RubricDetails version={after} />
            ) : hasChanges ? (
              <>
                {comparison!.settings.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Assessment settings</h3>
                    <ChangeValues changes={comparison!.settings} />
                  </section>
                )}

                {comparison!.skills.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Skills and evaluation anchors</h3>
                    <div className="space-y-3">
                      {comparison!.skills.map((skill) => (
                        <article key={skill.key} className="rounded-md border p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium">{skill.name}</h4>
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground capitalize">
                              {skill.type}
                            </span>
                          </div>
                          {skill.type === "added" && <p className="text-xs text-muted-foreground">Added to the later rubric.</p>}
                          {skill.type === "removed" && <p className="text-xs text-muted-foreground">Removed from the later rubric.</p>}
                          {skill.changes.length > 0 && <ChangeValues changes={skill.changes} />}
                        </article>
                      ))}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                These captured rubrics have no differences.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
