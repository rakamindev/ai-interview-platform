import type { AssessorOverride, PortfolioSkill } from "@/types";

// Dummy data shared by the portfolio review specs.
export function skillFixture(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
    return {
        id: 1,
        skill_label: "Contoh SQL",
        is_discovered: false,
        rating_status: "assessed",
        not_assessed_reason: null,
        coverage: { state: "covered", probe_count: 3 },
        ai_level: 2,
        ai_confidence: "high",
        effective_level: 2,
        level_source: "ai",
        assessor_confirmed: false,
        review: null,
        evidence: ["Kandidat Contoh: kutipan tentang SQL."],
        competency_summary: "Contoh ringkasan SQL.",
        ...overrides,
    };
}

export function overrideFixture(overrides: Partial<AssessorOverride> = {}): AssessorOverride {
    return {
        id: 50, portfolio_skill_id: 1, ai_level: 2, override_level: 3, assessor_notes: "Contoh catatan.",
        overridden_by: 7, overridden_at: "2026-10-25T08:00:00.000Z", lock_version: 1, ...overrides,
    };
}

export function httpError(status: number, data: Record<string, unknown> = {}) {
    return Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } });
}

export const networkError = Object.assign(new Error("Network Error"), { request: {}, response: undefined });
