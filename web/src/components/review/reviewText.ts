import { AlertTriangle, FileWarning, History, UserCheck, type LucideIcon } from "lucide-react";
import type { StatusTone } from "@/components/ui/status-badge";
import type { ReviewGroup, ReviewQueue, ReviewReason, ReviewReasonCode } from "@/types";

export interface ReviewGroupInfo {
  group: ReviewGroup;
  label: string;
  codes: ReviewReasonCode[];
  icon: LucideIcon;
}

// The four StatCards of the Needs review section, in reading order.
export const REVIEW_GROUPS: ReviewGroupInfo[] = [
  { group: "skills", label: "Skills awaiting review", codes: ["unreviewed_low_confidence", "unreviewed_not_assessed"], icon: UserCheck },
  { group: "narratives", label: "Narratives failed or outdated", codes: ["narrative_failed", "narrative_outdated"], icon: FileWarning },
  { group: "legacy", label: "Legacy portfolios", codes: ["legacy_ratings"], icon: History },
  { group: "portfolio", label: "Portfolios failed or empty", codes: ["generation_failed", "empty_portfolio"], icon: AlertTriangle },
];

const SKILL_CODES: ReviewReasonCode[] = ["unreviewed_low_confidence", "unreviewed_not_assessed"];

function plural(count: number, word: string) {
  return count === 1 ? word : `${word}s`;
}

export function groupCount(summary: ReviewQueue["summary"], info: ReviewGroupInfo): number {
  return info.codes.reduce((total, code) => total + (summary[code] ?? 0), 0);
}

export function reasonText({ code, count }: ReviewReason): string {
  switch (code) {
    case "unreviewed_low_confidence": return `${count} low confidence ${plural(count, "skill")}`;
    case "unreviewed_not_assessed": return `${count} ${plural(count, "skill")} not assessed`;
    case "narrative_failed": return count === 1 ? "Narrative failed" : `${count} narratives failed`;
    case "narrative_outdated": return count === 1 ? "Narrative outdated" : `${count} narratives outdated`;
    case "legacy_ratings": return "Legacy ratings";
    case "generation_failed": return "Portfolio generation failed";
    case "empty_portfolio": return "No skills in portfolio";
  }
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// How long an item has waited, in words; never a guessed time.
export function waitingText(since: string, now: Date = new Date()): string {
  const start = new Date(since).getTime();
  if (Number.isNaN(start)) return "waiting time unknown";
  const elapsed = Math.max(0, now.getTime() - start);
  if (elapsed < HOUR) return "waiting less than an hour";
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return `waiting ${hours} ${plural(hours, "hour")}`;
  }
  const days = Math.floor(elapsed / DAY);
  return `waiting ${days} ${plural(days, "day")}`;
}

// One line per reason group for a candidate row, or "Reviewed".
export function candidateReviewStatus(summary: ReviewReason[]): { text: string; tone: StatusTone }[] {
  const skills = summary.filter((r) => SKILL_CODES.includes(r.code)).reduce((total, r) => total + r.count, 0);
  const lines: { text: string; tone: StatusTone }[] = [];
  if (skills > 0) lines.push({ text: `${skills} ${plural(skills, "skill")} ${skills === 1 ? "needs" : "need"} review`, tone: "warning" });
  for (const reason of summary) {
    if (SKILL_CODES.includes(reason.code) || reason.code === "generation_failed") continue;
    lines.push({ text: reasonText(reason), tone: "warning" });
  }
  return lines.length > 0 ? lines : [{ text: "Reviewed", tone: "success" }];
}
