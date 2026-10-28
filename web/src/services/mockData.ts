import type {
  Assessment,
  Session,
  Portfolio,
  FitGapReport,
  Vacancy,
  TranscriptTurn,
} from "@/types";

export const mockAssessments: Assessment[] = [
  {
    id: 1,
    name: "Fullstack Product Engineer (Assessment)",
    time_limit_min: 45,
    language: "en",
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    latest_session: {
      status: "ended",
      end_reason: "completed",
    },
    skills: [
      {
        skill_label: "React / Frontend Architecture",
        expected_level: 3,
        display_order: 1,
        is_custom: false,
      },
      {
        skill_label: "TypeScript & Type Safety",
        expected_level: 4,
        display_order: 2,
        is_custom: false,
      },
      {
        skill_label: "System Design & Architecture",
        expected_level: 4,
        display_order: 3,
        is_custom: false,
      },
      {
        skill_label: "Security Engineering & Privacy",
        expected_level: 3,
        display_order: 4,
        is_custom: false,
      },
    ],
  },
];

export const mockSessions: Session[] = [
  {
    id: 1,
    assessment_id: 1,
    candidate_id: 101,
    candidate_name: "Kirei Pratama",
    invite_token: "demo-token-123",
    invite_url: "http://localhost:5173/interview/demo-token-123",
    status: "ended",
    end_reason: "completed",
    started_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    ended_at: new Date(Date.now() - 3600000 * 2.2).toISOString(),
    duration_seconds: 2880,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const mockPortfolio: Portfolio = {
  id: 1,
  session_id: 1,
  candidate_id: 101,
  generation_status: "complete",
  generated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  skills: [
    {
      id: 201,
      skill_label: "React / Frontend Architecture",
      is_discovered: false,
      ai_level: "L5",
      ai_confidence: "high",
      evidence: [
        "Candidate detailed custom memoization strategies and state-slicing to eliminate redundant DOM re-renders.",
        "Demonstrated clear understanding of compound components and atomic design patterns under enterprise constraints.",
      ],
      competency_summary:
        "Exceptional frontend craftsmanship. Articulates deep mastery of React component lifecycle, async state management, and high-performance rendering.",
    },
    {
      id: 202,
      skill_label: "TypeScript & Type Safety",
      is_discovered: false,
      ai_level: "L3",
      ai_confidence: "medium",
      evidence: [
        "Used generic type constraints and discriminated unions during architectural explanation.",
      ],
      competency_summary:
        "Solid command of static typing and contract integrity. Raised to L4 by human assessor upon reviewing advanced generic state implementations.",
    },
    {
      id: 203,
      skill_label: "System Design & Architecture",
      is_discovered: false,
      ai_level: "L3",
      ai_confidence: "high",
      evidence: [
        "Explained caching tiers and database read-replicas for high-traffic read paths.",
      ],
      competency_summary:
        "Capable of designing scalable multi-service workflows; handles standard caching and asynchronous messaging patterns.",
    },
    {
      id: 204,
      skill_label: "Security Engineering & Privacy",
      is_discovered: false,
      ai_level: "—",
      ai_confidence: "low",
      evidence: [],
      competency_summary:
        "Topic was not reached during the live interview session due to candidate prioritizing deep-dive system architecture. Marked as unassessed to preserve scoring fairness.",
    },
  ],
  overrides: [
    {
      id: 501,
      portfolio_skill_id: 202,
      ai_level: 3,
      override_level: 4,
      assessor_notes:
        "Candidate demonstrated L4 generic mapping and contract validation during portfolio code discussion. Overriding AI rating from L3 to L4.",
      overridden_at: new Date().toISOString(),
    },
  ],
};

export const mockVacancies: Vacancy[] = [
  {
    id: 1,
    role_title: "Senior Fullstack Product Engineer",
    culture_dimensions: "High ownership, first-principles problem solving, candidate empathy",
    competency_expectations: "Strong React/TypeScript foundations, resilient backend contracts",
    skills: [
      {
        skill_label: "React / Frontend Architecture",
        expected_level: 3,
      },
      {
        skill_label: "TypeScript & Type Safety",
        expected_level: 4,
      },
      {
        skill_label: "System Design & Architecture",
        expected_level: 4,
      },
      {
        skill_label: "Security Engineering & Privacy",
        expected_level: 3,
      },
    ],
  },
];

export const mockFitGapReport: FitGapReport = {
  id: 1,
  portfolio_id: 1,
  vacancy_id: 1,
  generated_at: new Date().toISOString(),
  skill_comparisons: [
    {
      skill_label: "React / Frontend Architecture",
      expected_level: 3,
      required_level: 3,
      candidate_level: 5,
      result: "exceed",
      delta: 2,
      is_override: false,
    },
    {
      skill_label: "TypeScript & Type Safety",
      expected_level: 4,
      required_level: 4,
      candidate_level: 4,
      result: "match",
      delta: 0,
      is_override: true,
    },
    {
      skill_label: "System Design & Architecture",
      expected_level: 4,
      required_level: 4,
      candidate_level: 3,
      result: "gap",
      delta: -1,
      is_override: false,
    },
    {
      skill_label: "Security Engineering & Privacy",
      expected_level: 3,
      required_level: 3,
      candidate_level: undefined,
      result: "not_assessed",
      delta: undefined,
      is_override: false,
    },
  ],
  culture_narrative:
    "Candidate embodies first-principles engineering and high Monozukuri craftsmanship. Proactively prioritizes user empathy, edge case resilience, and strict data privacy (UU PDP) over quick superficial patches.",
  overall_narrative:
    "Strong Recommendation to Advance. The candidate comfortably exceeds the baseline in Frontend Architecture (L5 vs L3 required), matches the rigorous TypeScript requirement with confirmed assessor validation, and exhibits honest communication regarding domain boundaries. A foundational addition to our enterprise product engineering team.",
};

export const mockTranscripts: TranscriptTurn[] = [
  {
    id: 1,
    turn_number: 1,
    speaker: "ai",
    text: "Welcome to the assessment! Let's start by discussing your approach to frontend state management and performance optimization.",
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: 2,
    turn_number: 2,
    speaker: "candidate",
    text: "I prioritize separating ephemeral UI state from server-cache state. Using tools like Jotai or React Query helps prevent waterfall network waterfalls and unnecessary re-renders.",
    created_at: new Date(Date.now() - 3600000 * 3 + 15000).toISOString(),
  },
];
