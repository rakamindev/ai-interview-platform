import type { AssessorOverride, EvidenceCheck, Portfolio, PortfolioSkill } from "@/types";

/** General level meanings (from the N10 prompt). Used when an assessment skill has no anchor text. */
export const DEFAULT_LEVEL_MEANING: Record<number, string> = {
  1: "Works with explicit guidance and close review.",
  2: "Works independently on routine scope; handles common cases.",
  3: "Handles complex, ambiguous work and makes trade-offs independently.",
  4: "Defines standards and builds reusable systems with cross-team impact.",
  5: "Shapes how the skill is practised across the organisation.",
};

export const NOT_RATED_TEXT: Record<string, string> = {
  missing_level: "The AI gave no rating for this skill.",
  invalid_level: "The AI's rating was not a valid level, so it isn't shown.",
  ai_omitted: "The AI returned no assessment for this skill.",
};

export type AttentionTier = "review" | "gap";
export interface AttentionItem {
  tier: AttentionTier;
  text: string;
  targetId: string; // DOM id of the place to act
}

export function overrideForSkill(portfolio: Portfolio, skill: PortfolioSkill): AssessorOverride | undefined {
  return portfolio.overrides.find((o) => o.portfolio_skill_id === skill.id);
}

export function evidenceCounts(checks: EvidenceCheck[] = []) {
  return {
    total: checks.length,
    matched: checks.filter((c) => c.status === "transcript_match").length,
    notExact: checks.filter((c) => c.status === "no_exact_match").length,
    notFound: checks.filter((c) => c.status === "not_found").length,
  };
}

/**
 * Things a human should look at before relying on the affected skill. Two tiers:
 * review (a human decision may no longer fit, or evidence couldn't be traced) and gap
 * (no AI rating). System status (re-scoring, failed re-score) is shown as a banner instead.
 */
export function attentionItems(portfolio: Portfolio): AttentionItem[] {
  const items: AttentionItem[] = [];
  const assessed = portfolio.skills.filter((s) => !s.is_discovered);

  for (const o of portfolio.overrides) {
    if (!o.needs_review) continue;
    if (o.orphaned) {
      items.push({ tier: "review", text: `An earlier decision refers to ${o.skill_label ?? "a skill"}, which is no longer in this report`, targetId: "earlier-decisions" });
    } else if (o.review_reason === "ai_level_changed") {
      items.push({ tier: "review", text: `Your decision on ${o.skill_label} may no longer fit: the AI's suggestion changed`, targetId: `skill-${o.portfolio_skill_id}` });
    } else if (o.review_reason === "conflicting_decisions") {
      items.push({ tier: "review", text: `${o.skill_label} had conflicting earlier decisions; the newest one is applied`, targetId: `skill-${o.portfolio_skill_id}` });
    }
  }

  for (const s of assessed) {
    const c = evidenceCounts(s.evidence_checks);
    if (c.notFound > 0) items.push({ tier: "review", text: `An excerpt for ${s.skill_label} wasn't found in the transcript`, targetId: `skill-${s.id}` });
    else if (c.notExact > 0) items.push({ tier: "review", text: `An excerpt for ${s.skill_label} isn't an exact transcript match`, targetId: `skill-${s.id}` });
    if (s.ai_level === null && !overrideForSkill(portfolio, s)) {
      items.push({ tier: "gap", text: `${s.skill_label} was not rated by the AI`, targetId: `skill-${s.id}` });
    }
  }
  // "Review required" first, then assessment gaps.
  return [...items.filter((i) => i.tier === "review"), ...items.filter((i) => i.tier === "gap")];
}

export function humanDecisionCount(portfolio: Portfolio): number {
  return portfolio.overrides.filter((o) => !o.orphaned && o.review_reason !== "superseded_by_newer_decision").length;
}

/** What the page should show, derived from the generation lifecycle. */
export type PageState = "first_scoring" | "first_failed" | "report";
export function pageState(portfolio: Portfolio | null, generating: boolean): PageState {
  if (!portfolio || (!portfolio.current_generation && generating)) return "first_scoring";
  if (!portfolio.current_generation) return portfolio.generation_status === "failed" ? "first_failed" : "first_scoring";
  return "report";
}

export type ReportBanner = { kind: "rescoring" | "rescore_failed"; text: string } | null;
export function reportBanner(portfolio: Portfolio): ReportBanner {
  const latest = portfolio.latest_generation;
  const current = portfolio.current_generation;
  if (!latest || !current || latest.id === current.id) return null;
  const since = current.finished_at ? new Date(current.finished_at).toLocaleString() : "the previous run";
  if (["queued", "running", "retrying"].includes(latest.status)) {
    return { kind: "rescoring", text: `Re-scoring… you're viewing the report from ${since} until it finishes.` };
  }
  if (latest.status === "failed") {
    const admin = ["model_unavailable", "auth_failed", "quota_exhausted", "bad_request"].includes(latest.error_code ?? "");
    return {
      kind: "rescore_failed",
      text: admin
        ? "A re-score didn't complete: the scoring service isn't configured correctly for this account. An administrator needs to fix it. This report is still current."
        : "A re-score didn't complete. This report is still current.",
    };
  }
  return null;
}
