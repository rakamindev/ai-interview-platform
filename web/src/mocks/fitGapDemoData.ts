import type {
  Assessment,
  FitGapReport,
  Portfolio,
  Session,
  SkillComparison,
  Vacancy,
} from "@/types";

const now = "2026-10-27T09:00:00.000Z";
const longSkillName =
  "Distributed Systems Observability, Resilience, and Multi-Region Incident Response";

export const demoAssessment: Assessment = {
  id: 101,
  name: "Senior Product Engineer — Demo Assessment",
  time_limit_min: 45,
  language: "en",
  created_at: now,
  skills: [
    { id: 1, skill_id: 1, skill_label: "React and TypeScript", is_custom: false, expected_level: 3, display_order: 0 },
    { id: 2, skill_id: 2, skill_label: "API Design", is_custom: false, expected_level: 4, display_order: 1 },
    { id: 3, skill_id: 3, skill_label: "System Design", is_custom: false, expected_level: 3, display_order: 2 },
  ],
};

export const demoSessions: Session[] = [
  {
    id: 501,
    assessment_id: demoAssessment.id,
    candidate_name: "Kandidat Contoh 1",
    invite_token: "demo-candidate-1",
    invite_url: `${window.location.origin}/interview/demo-candidate-1`,
    status: "ended",
    end_reason: "completed",
    started_at: now,
    ended_at: now,
    duration_seconds: 2540,
    created_at: now,
  },
  {
    id: 502,
    assessment_id: demoAssessment.id,
    candidate_name: "Kandidat Contoh 2",
    invite_token: "demo-candidate-2",
    invite_url: `${window.location.origin}/interview/demo-candidate-2`,
    status: "ended",
    end_reason: "completed",
    started_at: now,
    ended_at: now,
    duration_seconds: 2210,
    created_at: now,
  },
  {
    id: 503,
    assessment_id: demoAssessment.id,
    candidate_name: "Kandidat Contoh 3",
    invite_token: "demo-candidate-3",
    invite_url: `${window.location.origin}/interview/demo-candidate-3`,
    status: "pending",
    created_at: now,
  },
];

export const demoVacancies: Vacancy[] = [
  {
    id: 901,
    role_title: "Frontend Platform Engineer",
    culture_dimensions: "Thoughtful collaboration; pragmatic experimentation.",
    competency_expectations: "Build reliable interfaces and improve developer experience.",
    created_at: now,
    skills: [
      { id: 1, skill_id: 1, skill_label: "React and TypeScript", expected_level: 3 },
      { id: 2, skill_id: 2, skill_label: "API Design", expected_level: 4 },
      { id: 3, skill_id: 3, skill_label: "System Design", expected_level: 4 },
    ],
  },
  {
    id: 902,
    role_title: "Full-Stack Product Engineer",
    culture_dimensions: "Clear communication; ownership.",
    competency_expectations: "Deliver product outcomes across the stack.",
    created_at: now,
    skills: [
      { id: 1, skill_id: 1, skill_label: "React and TypeScript", expected_level: 4 },
      { id: 2, skill_id: 4, skill_label: "Database Reliability", expected_level: 3 },
      { id: 3, skill_id: 5, skill_label: "Security Engineering", expected_level: 4 },
    ],
  },
  {
    id: 903,
    role_title: "Distributed Systems Engineer",
    culture_dimensions: "Calm incident response; learning mindset.",
    competency_expectations: "Design for reliability across regions.",
    created_at: now,
    skills: [
      { id: 1, skill_id: 6, skill_label: longSkillName, expected_level: null },
      { id: 2, skill_id: 7, skill_label: "Cloud Security", expected_level: 3 },
      { id: 3, skill_id: 8, skill_label: "Operational Readiness", expected_level: 4 },
    ],
  },
];

const comparison = (
  skillId: number,
  skillLabel: string,
  expectedLevel: number | null,
  candidateLevel: number | null,
  overridden = false
): SkillComparison => {
  const delta = expectedLevel == null || candidateLevel == null
    ? null
    : candidateLevel - expectedLevel;
  const result = candidateLevel == null
    ? "not_assessed"
    : delta === 0
      ? "match"
      : delta! > 0
        ? "exceed"
        : "gap";

  return {
    skill_id: skillId,
    skill_label: skillLabel,
    candidate_level: candidateLevel,
    expected_level: expectedLevel,
    delta,
    result,
    overridden,
    confidence: candidateLevel == null ? null : "high",
  };
};

export const demoPortfolios: Record<number, Portfolio> = {
  501: {
    id: 801,
    session_id: 501,
    candidate_id: 1501,
    generation_status: "complete",
    generated_at: now,
    skills: [
      {
        id: 8011,
        skill_id: 1,
        skill_label: "React and TypeScript",
        is_discovered: false,
        ai_level: "L3",
        ai_confidence: "high",
        evidence: ["Explained component boundaries and typed API states."],
        competency_summary: "Builds maintainable frontend features.",
      },
      {
        id: 8012,
        skill_id: 2,
        skill_label: "API Design",
        is_discovered: false,
        ai_level: "L3",
        ai_confidence: "medium",
        evidence: ["Discussed versioning and error handling."],
        competency_summary: "Understands common API design trade-offs.",
      },
      {
        id: 8013,
        skill_id: 3,
        skill_label: "System Design",
        is_discovered: false,
        ai_level: "L2",
        ai_confidence: "low",
        evidence: [],
        competency_summary: "Evidence was limited in the interview.",
      },
    ],
    overrides: [
      {
        id: 8801,
        portfolio_skill_id: 8011,
        ai_level: 3,
        override_level: 4,
        assessor_notes: "Override for demo only.",
        overridden_at: now,
      },
    ],
  },
  502: {
    id: 802,
    session_id: 502,
    candidate_id: 1502,
    generation_status: "complete",
    generated_at: now,
    skills: [
      {
        id: 8021,
        skill_id: 1,
        skill_label: "React and TypeScript",
        is_discovered: false,
        ai_level: "L4",
        ai_confidence: "high",
        evidence: ["Compared UI architecture options."],
        competency_summary: "Demonstrates strong frontend judgment.",
      },
      {
        id: 8022,
        skill_id: 2,
        skill_label: "API Design",
        is_discovered: false,
        ai_level: "L2",
        ai_confidence: "medium",
        evidence: ["Identified basic request validation needs."],
        competency_summary: "Has developing API design experience.",
      },
      {
        id: 8023,
        skill_id: 99,
        skill_label: "Accessibility Testing",
        is_discovered: true,
        ai_level: "L4",
        ai_confidence: "high",
        evidence: ["Outlined keyboard and screen-reader testing."],
        competency_summary: "Proactively considers accessibility.",
      },
    ],
    overrides: [],
  },
};

export const demoReports: Record<string, FitGapReport> = {};

for (const [sessionId, portfolio] of Object.entries(demoPortfolios)) {
  for (const vacancy of demoVacancies) {
    const skillComparisons: SkillComparison[] = vacancy.skills.map((skill, index) => {
      if (sessionId === "501" && vacancy.id === 901 && index === 0) {
        return comparison(skill.skill_id ?? 0, skill.skill_label, skill.expected_level, 4, true);
      }
      if (sessionId === "501" && vacancy.id === 901 && index === 2) {
        return comparison(skill.skill_id ?? 0, skill.skill_label, skill.expected_level, null);
      }
      const portfolioSkill = portfolio.skills.find((candidate) => candidate.skill_id === skill.skill_id);
      const candidateLevel = portfolioSkill
        ? Number(portfolioSkill.ai_level.replace("L", ""))
        : null;
      return comparison(skill.skill_id ?? 0, skill.skill_label, skill.expected_level, candidateLevel);
    });

    demoReports[`${portfolio.id}:${vacancy.id}`] = {
      id: portfolio.id * 10 + vacancy.id,
      portfolio_id: portfolio.id,
      vacancy_id: vacancy.id,
      skill_comparisons: skillComparisons,
      culture_narrative:
        "Demo narrative: demonstrates thoughtful collaboration and clear trade-off reasoning. Validate these observations against the interview evidence.",
      overall_narrative:
        "Demo summary: use this report as an example of the interface, not as a real candidate evaluation.",
      generated_at: now,
    };
  }
}

export const demoAssessmentDetail = demoAssessment;
