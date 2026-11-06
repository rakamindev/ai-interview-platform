import { describe, expect, it } from "vitest";
import type { AssessorOverride, Portfolio, PortfolioGeneration, PortfolioSkill } from "@/types";
import { attentionItems, evidenceCounts, humanDecisionCount, pageState, reportBanner } from "./portfolioReview";

const gen = (id: number, status: PortfolioGeneration["status"], extra: Partial<PortfolioGeneration> = {}): PortfolioGeneration => ({
  id, sequence: id, status, source: "test", finished_at: "2026-11-06T08:00:00Z", ...extra,
});

const skill = (id: number, extra: Partial<PortfolioSkill> = {}): PortfolioSkill => ({
  id, skill_label: `Skill ${id}`, is_discovered: false, ai_level: 3, ai_confidence: "high",
  evidence: [], evidence_checks: [], competency_summary: "", ...extra,
});

const override = (skillId: number, extra: Partial<AssessorOverride> = {}): AssessorOverride => ({
  id: skillId * 10, portfolio_skill_id: skillId, ai_level: 3, override_level: 4, assessor_notes: "",
  skill_label: `Skill ${skillId}`, needs_review: false, review_reason: null, orphaned: false, ...extra,
});

const portfolio = (extra: Partial<Portfolio> = {}): Portfolio => ({
  id: 1, session_id: 1, generation_status: "complete", current_generation: gen(1, "succeeded"),
  latest_generation: gen(1, "succeeded"), skills: [], overrides: [], ...extra,
});

describe("pageState: which screen the assessor sees", () => {
  it("shows scoring before the first report exists", () => {
    expect(pageState(null, false)).toBe("first_scoring");
    expect(pageState(portfolio({ current_generation: null, generation_status: "generating" }), true)).toBe("first_scoring");
  });

  it("shows the first-failure screen only when no report was ever published", () => {
    expect(pageState(portfolio({ current_generation: null, generation_status: "failed" }), false)).toBe("first_failed");
  });

  it("keeps showing the report once one exists, even while a re-score runs or fails", () => {
    expect(pageState(portfolio({ generation_status: "generating" }), true)).toBe("report");
    expect(pageState(portfolio({ generation_status: "failed" }), false)).toBe("report");
  });
});

describe("reportBanner: re-score status above an existing report (G2)", () => {
  it("is empty when the latest run is the one being shown", () => {
    expect(reportBanner(portfolio())).toBeNull();
  });

  it("says the old report stays visible while re-scoring", () => {
    const banner = reportBanner(portfolio({ latest_generation: gen(2, "running") }));
    expect(banner?.kind).toBe("rescoring");
    expect(banner?.text).toMatch(/viewing the report from/);
  });

  it("keeps the report current after a temporary failure", () => {
    const banner = reportBanner(portfolio({ latest_generation: gen(2, "failed", { error_code: "timeout" }) }));
    expect(banner).toEqual({ kind: "rescore_failed", text: "A re-score didn't complete. This report is still current." });
  });

  it("tells the assessor an administrator is needed for a configuration failure", () => {
    const banner = reportBanner(portfolio({ latest_generation: gen(2, "failed", { error_code: "model_unavailable" }) }));
    expect(banner?.text).toMatch(/administrator needs to fix it/);
  });
});

describe("attentionItems: what to look at first", () => {
  it("lists review items before rating gaps", () => {
    const p = portfolio({
      skills: [skill(1, { ai_level: null, ai_level_reason: "missing_level" }), skill(2, { evidence_checks: [{ quote: "q", status: "not_found" }] })],
    });
    expect(attentionItems(p).map((i) => [i.tier, i.targetId])).toEqual([["review", "skill-2"], ["gap", "skill-1"]]);
  });

  it("flags a human decision when the AI's suggestion changed (G3)", () => {
    const p = portfolio({ skills: [skill(1)], overrides: [override(1, { needs_review: true, review_reason: "ai_level_changed" })] });
    expect(attentionItems(p)).toEqual([
      { tier: "review", text: "Your decision on Skill 1 may no longer fit: the AI's suggestion changed", targetId: "skill-1" },
    ]);
  });

  it("points an orphaned decision at the earlier-decisions list", () => {
    const p = portfolio({ overrides: [override(9, { needs_review: true, orphaned: true, review_reason: "skill_missing_in_current" })] });
    expect(attentionItems(p)[0].targetId).toBe("earlier-decisions");
  });

  it("does not report a Not rated skill as a gap once the assessor has rated it (G1 + G3)", () => {
    const p = portfolio({ skills: [skill(1, { ai_level: null })], overrides: [override(1, { ai_level: null })] });
    expect(attentionItems(p)).toEqual([]);
  });

  it("reports an inexact excerpt, and ignores discovered skills", () => {
    const p = portfolio({
      skills: [
        skill(1, { evidence_checks: [{ quote: "q", status: "no_exact_match", suggested_turn: 4 }] }),
        skill(2, { is_discovered: true, ai_level: null, evidence_checks: [{ quote: "q", status: "not_found" }] }),
      ],
    });
    expect(attentionItems(p).map((i) => i.text)).toEqual(["An excerpt for Skill 1 isn't an exact transcript match"]);
  });

  it("is empty when everything is traceable and rated", () => {
    expect(attentionItems(portfolio({ skills: [skill(1, { evidence_checks: [{ quote: "q", status: "transcript_match", turn_numbers: [2] }] })] }))).toEqual([]);
  });
});

describe("counts", () => {
  it("counts evidence by check status", () => {
    expect(evidenceCounts([
      { quote: "a", status: "transcript_match" }, { quote: "b", status: "no_exact_match" }, { quote: "c", status: "not_found" },
    ])).toEqual({ total: 3, matched: 1, notExact: 1, notFound: 1 });
    expect(evidenceCounts()).toEqual({ total: 0, matched: 0, notExact: 0, notFound: 0 });
  });

  it("counts only decisions that still apply", () => {
    const p = portfolio({
      overrides: [override(1), override(2, { orphaned: true }), override(3, { review_reason: "superseded_by_newer_decision" })],
    });
    expect(humanDecisionCount(p)).toBe(1);
  });
});
