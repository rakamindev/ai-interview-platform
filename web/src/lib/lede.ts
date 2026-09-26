import type { HomeSummary } from "@/types/home";

// One part of the lede. A part with an href is a number that links to its module.
export interface LedePart {
  text: string;
  href?: string;
}

export interface Lede {
  sentences: LedePart[][];
  calm: boolean;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

// The brief's one read: harm first, then work and what is live.
// A zero clause is never printed. "New" is only said when the page knows the last visit.
export function buildLede(summary: HomeSummary, resultsThisWeek: number): Lede {
  const harm: LedePart[] = [];
  const failed = summary.failed_needing_reinvite;
  const stuck = summary.stuck_reports;

  if (failed > 0) {
    harm.push({ text: `${failed} ${plural(failed, "interview", "interviews")}`, href: "#needs-you" });
    harm.push({ text: ` failed on our side and ${plural(failed, "needs", "need")} a re-invite` });
  }
  if (stuck > 0) {
    if (harm.length) harm.push({ text: ", and " });
    harm.push({ text: `${stuck} ${plural(stuck, "report", "reports")}`, href: "#needs-you" });
    harm.push({ text: plural(stuck, " is stuck", " are stuck") });
  }

  const work: LedePart[] = [];
  const isNew = summary.new_results !== undefined;
  const results = isNew ? summary.new_results ?? 0 : resultsThisWeek;
  const look = isNew ? summary.new_needs_look ?? 0 : summary.needs_look_7d;

  if (results > 0) {
    const noun = isNew ? plural(results, "new result", "new results") : plural(results, "result", "results");
    work.push({ text: `${results} ${noun}`, href: "#results" });
    work.push({ text: `${plural(results, " is", " are")} ready${isNew ? "" : " this week"}` });
    if (look > 0) {
      work.push({ text: ", " });
      work.push({ text: `${look}`, href: "#results" });
      work.push({ text: ` of them ${plural(look, "needs", "need")} a human look` });
    }
  }
  if (summary.live > 0) {
    if (work.length) work.push({ text: ", and " });
    work.push({ text: `${summary.live} ${plural(summary.live, "candidate", "candidates")}`, href: "#live" });
    work.push({ text: plural(summary.live, " is interviewing now", " are interviewing now") });
  }

  const sentences = [harm, work].filter((s) => s.length > 0).map((s) => [...s, { text: "." }]);
  if (sentences.length === 0) return { sentences: [[{ text: "Nothing needs you right now." }]], calm: true };
  return { sentences, calm: false };
}

export const ledeText = (lede: Lede) => lede.sentences.map((s) => s.map((p) => p.text).join("")).join(" ");
