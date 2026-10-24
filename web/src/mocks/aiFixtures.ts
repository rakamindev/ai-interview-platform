import type { CoverageMap, FitGapReport, Portfolio } from "@/types";

export const MOCK_AI_ENABLED = import.meta.env.VITE_MOCK_AI === "true";

export const mockPortfolio: Portfolio = {
  id: 9001,
  session_id: 1,
  candidate_id: 101,
  generation_status: "complete",
  generated_at: new Date().toISOString(),
  overrides: [],
  skills: [
    {
      id: 9101,
      skill_id: 1,
      skill_label: "React",
      is_discovered: false,
      ai_level: "L4",
      ai_confidence: "high",
      competency_summary: "Designs reusable React components and manages complex UI state with clear trade-offs.",
      evidence: [
        "Built a component system used across multiple product surfaces.",
        "Explained state ownership and performance trade-offs in the interview.",
      ],
    },
    {
      id: 9102,
      skill_id: 2,
      skill_label: "TypeScript",
      is_discovered: false,
      ai_level: "L4",
      ai_confidence: "high",
      competency_summary: "Uses TypeScript to make frontend contracts explicit and safer to evolve.",
      evidence: [
        "Described typed API boundaries and discriminated UI states.",
        "Used strict typing to prevent regressions in a production feature.",
      ],
    },
    {
      id: 9103,
      skill_id: 3,
      skill_label: "Testing",
      is_discovered: false,
      ai_level: "L3",
      ai_confidence: "medium",
      competency_summary: "Applies unit and integration testing to critical user flows.",
      evidence: ["Provided examples of testing async form and error states."],
    },
    {
      id: 9104,
      skill_id: 4,
      skill_label: "Accessibility",
      is_discovered: true,
      ai_level: "L3",
      ai_confidence: "medium",
      competency_summary: "Considers keyboard access, semantics, and feedback for diverse users.",
      evidence: ["Proactively discussed accessible interaction patterns during the interview."],
    },
  ],
};

export const mockFitGapReport: FitGapReport = {
  id: 9201,
  portfolio_id: mockPortfolio.id,
  vacancy_id: 1,
  generated_at: new Date().toISOString(),
  culture_narrative: "The candidate shows strong ownership and communicates technical trade-offs clearly. They appear comfortable working in an iterative product team.",
  overall_narrative: "Strong fit for a frontend role. The clearest development area is making testing strategy more systematic across larger codebases.",
  skill_comparisons: [
    { skill_label: "React", required_level: 4, candidate_level: 4, result: "match", delta: 0 },
    { skill_label: "TypeScript", required_level: 3, candidate_level: 4, result: "exceed", delta: 1 },
    { skill_label: "Testing", required_level: 4, candidate_level: 3, result: "gap", delta: -1 },
    { skill_label: "System design", required_level: 3, candidate_level: 3, result: "match", delta: 0 },
  ],
};

export const mockCoverageMap: CoverageMap = {
  updated_at: new Date().toISOString(),
  skills: [
    { id: 9301, skill_id: 1, skill_label: "React", is_discovered: false, state: "covered", probe_count: 3, last_signal: "Explained component composition and state boundaries." },
    { id: 9302, skill_id: 2, skill_label: "TypeScript", is_discovered: false, state: "covered", probe_count: 2, last_signal: "Described typed contracts for API responses." },
    { id: 9303, skill_id: 3, skill_label: "Testing", is_discovered: false, state: "partial", probe_count: 2, last_signal: "Mentioned async flow tests; depth still being assessed." },
  ],
  discovered: [
    { id: 9304, skill_id: 4, skill_label: "Accessibility", is_discovered: true, state: "initiated", probe_count: 1, last_signal: "Discussed keyboard navigation and semantic markup." },
  ],
};
