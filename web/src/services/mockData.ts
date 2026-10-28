// Dataset mock untuk keperluan pengujian dan review lokal
import type { SkillTaxonomy, Assessment, Vacancy, FitGapReport, Session } from "@/types";

export const MOCK_SKILL_TAXONOMIES: SkillTaxonomy[] = [
  {
    skill_id: "SK-ENG-001",
    skill_label: "React / Frontend Development Core",
    category: "engineering",
    scope_include: "Component design, state management, hooks, performance optimization",
    scope_exclude: "Backend APIs, mobile (React Native)",
    l1_anchor: "Implements components from specs with close review. Basic hooks (useState, useEffect).",
    l2_anchor: "Builds routine features independently. Uses Context or Redux.",
    l3_anchor: "Designs and builds complex features end-to-end. Optimizes rendering.",
    l4_anchor: "Defines frontend standards for the team. Leads architecture decisions.",
    l5_anchor: "Defines frontend architecture strategy for the org.",
  },
  {
    skill_id: "SK-ENG-002",
    skill_label: "Node.js / Backend Development",
    category: "engineering",
    scope_include: "REST API design, async patterns, middleware, background jobs",
    scope_exclude: "Infrastructure, frontend UI",
    l1_anchor: "Writes basic endpoints following existing patterns.",
    l2_anchor: "Builds standard CRUD APIs and basic services.",
    l3_anchor: "Designs robust backend services with error handling.",
    l4_anchor: "Architects scalable distributed systems and data pipelines.",
    l5_anchor: "Sets organization-wide backend engineering directions.",
  },
  {
    skill_id: "SK-ENG-003",
    skill_label: "PostgreSQL & Database Design",
    category: "engineering",
    scope_include: "Schema design, normalization, indexing, transactions",
    scope_exclude: "NoSQL databases",
    l1_anchor: "Writes basic SQL queries (SELECT, JOIN, INSERT).",
    l2_anchor: "Designs normalized tables and writes efficient migrations.",
    l3_anchor: "Optimizes slow queries using EXPLAIN ANALYZE and proper indexing.",
    l4_anchor: "Architects high-availability database setups and partitioning.",
    l5_anchor: "Drives org-wide data persistence and caching strategies.",
  },
  {
    skill_id: "SK-ENG-004",
    skill_label: "System Design & Architecture",
    category: "engineering",
    scope_include: "Microservices, API contracts, caching, message queues",
    scope_exclude: "Basic procedural scripting",
    l1_anchor: "Understands client-server models and basic HTTP protocols.",
    l2_anchor: "Designs component interactions within a single service.",
    l3_anchor: "Designs resilient multi-service architectures with caching.",
    l4_anchor: "Leads cross-system architecture reviews and scalability planning.",
    l5_anchor: "Sets technology roadmap across multiple business units.",
  },
  {
    skill_id: "SK-ENG-005",
    skill_label: "UI/UX & Design Systems",
    category: "design",
    scope_include: "Design tokens, accessibility (a11y), responsive layouts, Tailwind CSS",
    scope_exclude: "Marketing graphic design",
    l1_anchor: "Translates Figma mockups into working HTML/CSS components.",
    l2_anchor: "Builds consistent, accessible components following design guidelines.",
    l3_anchor: "Maintains reusable design system components and interaction states.",
    l4_anchor: "Defines design token architecture and UX governance standards.",
    l5_anchor: "Drives product design vision and engineering integration.",
  }
];

// Tiga kandidat representatif untuk keperluan demonstrasi hasil evaluasi
export const MOCK_SESSIONS: Session[] = [
  {
    id: 1,
    assessment_id: 1,
    candidate_name: "Budi Santoso",
    invite_token: "mock-token-budi",
    invite_url: "http://localhost:5173/interview/mock-token-budi",
    status: "ended",
    end_reason: "completed",
    started_at: "2026-10-27T10:00:00Z",
    duration_seconds: 1800
  },
  {
    id: 2,
    assessment_id: 1,
    candidate_name: "Ahmad Fauzi",
    invite_token: "mock-token-fauzi",
    invite_url: "http://localhost:5173/interview/mock-token-fauzi",
    status: "ended",
    end_reason: "needs_review",
    started_at: "2026-10-27T11:30:00Z",
    duration_seconds: 1900
  },
  {
    id: 3,
    assessment_id: 1,
    candidate_name: "Fadhil Farhan",
    invite_token: "mock-token-fadhil",
    invite_url: "http://localhost:5173/interview/mock-token-fadhil",
    status: "ended",
    end_reason: "error",
    started_at: "2026-10-27T14:15:00Z",
    duration_seconds: 1200
  }
];

export const MOCK_ASSESSMENTS: Assessment[] = [
  {
    id: 1,
    name: "Frontend Engineer Screening",
    time_limit_min: 45,
    language: "en",
    created_at: new Date().toISOString(),
    latest_session: {
      status: "ended",
      end_reason: "completed"
    },
    skills: [
      {
        id: 101,
        skill_id: 1,
        skill_label: "React / Frontend Development Core",
        is_custom: false,
        expected_level: 3,
        display_order: 0
      },
      {
        id: 102,
        skill_id: 4,
        skill_label: "System Design & Architecture",
        is_custom: false,
        expected_level: 3,
        display_order: 1
      },
      {
        id: 103,
        skill_id: 5,
        skill_label: "UI/UX & Design Systems",
        is_custom: false,
        expected_level: 2,
        display_order: 2
      }
    ]
  }
];

export const MOCK_VACANCIES: Vacancy[] = [
  {
    id: 1,
    role_title: "Frontend Engineer Intern",
    culture_dimensions: "High autonomy, collaborative, learning by doing",
    competency_expectations: "Demonstrates strong fundamentals in modern React, attention to UX details, and proactive problem solving.",
    skills: [
      {
        id: 201,
        skill_id: 1,
        skill_label: "React / Frontend Development Core",
        expected_level: 3
      },
      {
        id: 202,
        skill_id: 4,
        skill_label: "System Design & Architecture",
        expected_level: 3
      },
      {
        id: 203,
        skill_id: 5,
        skill_label: "UI/UX & Design Systems",
        expected_level: 2
      }
    ]
  },
  {
    id: 2,
    role_title: "Junior Fullstack Engineer",
    culture_dimensions: "Fast iteration, product ownership, cross-functional teamwork",
    competency_expectations: "Solid React UI skills combined with practical Node.js / PostgreSQL backend design and REST API fundamentals.",
    skills: [
      {
        id: 204,
        skill_id: 1,
        skill_label: "React / Frontend Development Core",
        expected_level: 3
      },
      {
        id: 205,
        skill_id: 2,
        skill_label: "Node.js / Backend Development",
        expected_level: 3
      },
      {
        id: 206,
        skill_id: 3,
        skill_label: "PostgreSQL & Database Design",
        expected_level: 2
      }
    ]
  }
];

// Baseline data untuk mereplikasi bug bawaan dari backend:
// 1. Kolom Required kosong karena API mengirim expected_level, sedangkan web membaca required_level.
// 2. Skill yang belum dinilai (unassessed) otomatis diberi level 1 dan dicap gap.
export const MOCK_FIT_GAP_REPORT: FitGapReport = {
  id: 1,
  portfolio_id: 10,
  vacancy_id: 1,
  generated_at: new Date().toISOString(),
  culture_narrative: "Candidate shows good communication and proactive problem solving mindset.",
  overall_narrative: "Strong performance in React core concepts. However, candidate lacks proficiency in System Design (marked as Gap).",
  skill_comparisons: [
    {
      skill_label: "React / Frontend Development Core",
      // Sesuai bug asli: API mengirim expected_level
      ...({ expected_level: 3 } as any),
      required_level: undefined as any, // di baseline kosong karena beda nama field!
      candidate_level: 3,
      result: "match",
      delta: 0,
      is_override: false
    },
    {
      skill_label: "UI/UX & Design Systems",
      ...({ expected_level: 2 } as any),
      required_level: undefined as any,
      candidate_level: 3,
      result: "exceed",
      delta: 1,
      is_override: false
    },
    {
      // Ini contoh P0 Defect: Skill belum diuji tapi otomatis dapat L1 dan dituduh GAP
      skill_label: "System Design & Architecture",
      ...({ expected_level: 3 } as any),
      required_level: undefined as any,
      candidate_level: 1, // Bug: fake L1
      result: "gap",      // Bug: false gap
      delta: -2,
      is_override: false
    }
  ]
};
