// API payloads in the exact shape the Rails serializers return (flat JSON, no
// `data` envelope), with the same synthetic values as the API's functional
// journey (api/spec/functional/assessor_journey_spec.rb). Keeping the shape
// faithful is what lets these tests catch seam bugs between api/ and web/.

export const assessment = {
  id: 7,
  name: "Senior Frontend Engineer",
  time_limit_min: 45,
  language: "en",
  system_prompt: "You are an expert skills assessor...",
  created_by: 1,
  created_at: "2026-10-01T09:00:00Z",
  updated_at: "2026-10-01T09:00:00Z",
  latest_session: null as null | { id: number; status: string; end_reason: string | null },
};

export function assessmentList(items: Array<Partial<typeof assessment>>, total = items.length) {
  return {
    assessments: items.map((a, i) => ({ ...assessment, id: i + 1, ...a })),
    meta: { current_page: 1, total_pages: Math.max(1, Math.ceil(total / 20)), total_count: total, per_page: 20 },
  };
}

export const session = {
  id: 42,
  assessment_id: 7,
  tenant_id: 1,
  candidate_id: null,
  candidate_name: "Test Candidate",
  invite_token: "tok-test-123",
  invite_url: "http://localhost:5173/interview/tok-test-123",
  status: "ended",
  end_reason: "all_covered",
  started_at: "2026-10-01T09:00:00Z",
  ended_at: "2026-10-01T09:38:45Z",
  duration_seconds: 2325,
  created_at: "2026-10-01T08:55:00Z",
};

export const sessionShow = {
  session: { ...session, assessment: { id: 7, name: "Senior Frontend Engineer", time_limit_min: 45 } },
};

const skill = (id: number, fields: Record<string, unknown>) => ({
  id,
  skill_id: null,
  is_discovered: false,
  evidence: [] as string[],
  competency_summary: "",
  ...fields,
});

export const portfolio = {
  id: 9,
  session_id: 42,
  candidate_id: null,
  generation_status: "complete",
  generated_at: "2026-10-01T09:41:00Z",
  generation_error: null as string | null,
  skills: [
    skill(101, {
      skill_id: "SK-ENG-001", skill_label: "React", ai_level: 3, ai_confidence: "high",
      evidence: ["We moved critical real-time data into local component state with useRef."],
      competency_summary: "Handles complex state with clear trade-offs.",
    }),
    skill(102, {
      skill_id: "SK-SOFT-001", skill_label: "Communication", ai_level: 2, ai_confidence: "medium",
      evidence: ["I put together a one-pager with the profiling data and shared it in Slack before the meeting."],
      competency_summary: "Clear one to one; async communication is reactive.",
    }),
    skill(103, {
      skill_id: "SK-ENG-003", skill_label: "System Design", ai_level: 3, ai_confidence: "high",
      evidence: ["I would start with the data contracts and set the performance budget before the architecture."],
      competency_summary: "Leads with data contracts and budgets.",
    }),
    skill(104, {
      skill_label: "Micro-frontend Architecture", is_discovered: true, ai_level: 2, ai_confidence: "low",
      evidence: ["We decomposed into micro-frontends using Module Federation."],
      competency_summary: "Hands-on experience; briefly explored.",
    }),
  ],
  overrides: [] as unknown[],
};

export const vacancies = {
  vacancies: [
    { id: 5, role_title: "Senior Frontend Engineer (TechCorp)", culture_dimensions: "ownership", competency_expectations: "", skills: [] },
  ],
  meta: { current_page: 1, total_pages: 1, total_count: 1, per_page: 20 },
};

// FitGap::Engine#build_skill_comparisons
export const fitGapReport = {
  report: {
    id: 3,
    portfolio_id: 9,
    vacancy_id: 5,
    skill_comparisons: [
      { skill_label: "React", skill_id: "SK-ENG-001", candidate_level: 3, expected_level: 3, result: "match", delta: 0, confidence: "high" },
      { skill_label: "Communication", skill_id: "SK-SOFT-001", candidate_level: 2, expected_level: 3, result: "gap", delta: -1, confidence: "medium" },
      { skill_label: "System Design", skill_id: "SK-ENG-003", candidate_level: 3, expected_level: 2, result: "exceed", delta: 1, confidence: "high" },
    ],
    culture_narrative: "Strong ownership; probe async communication next.",
    overall_narrative: "Recommend a second interview focused on communication.",
    generated_at: "2026-10-01T09:45:00Z",
  },
};

export const candidateInfo = {
  session_id: 42,
  role_title: "Senior Frontend Engineer",
  time_limit_min: 45,
  session_status: "pending",
};

export const notFound = (message: string) => ({ errors: [{ status: 404, message }] });

// Messages on the live monitor's WebSocket, exactly as the API publishes them
// (pinned by api/spec/integration/coverage_channel_spec.rb).
const coverageSkill = (id: number, skill_label: string, state: string, probe_count: number, extra: Record<string, unknown> = {}) => ({
  id, skill_id: null, skill_label, is_discovered: false, state, probe_count, last_signal: null, ...extra,
});

export const coverageMessages = {
  // Sent by CoverageWebSocketMiddleware right after auth.
  initial: (status = "active", end_reason: string | null = null) => ({
    type: "coverage_update",
    status,
    end_reason,
    skills: [
      coverageSkill(1, "React", "partial", 2, { skill_id: "SK-ENG-001", last_signal: "Profiled with React DevTools" }),
      coverageSkill(2, "Communication", "not_yet", 0),
      coverageSkill(3, "System Design", "not_yet", 0),
    ],
    discovered: [] as unknown[],
  }),
  // Published by CoverageAnalyzerWorker after each analysis.
  update: () => ({
    type: "coverage_update",
    skills: [
      coverageSkill(1, "React", "covered", 5, { skill_id: "SK-ENG-001" }),
      coverageSkill(2, "Communication", "initiated", 1),
      coverageSkill(3, "System Design", "not_yet", 0),
    ],
    discovered: [coverageSkill(4, "Micro-frontend Architecture", "initiated", 1, { is_discovered: true })],
  }),
  // Published by Sessions::EndHandler.
  ended: (end_reason = "time_ceiling") => ({ type: "session_status", status: "ended", end_reason }),
};

export const activeSession = {
  session: { ...session, status: "active", end_reason: null, ended_at: null, duration_seconds: null,
             assessment: { id: 7, name: "Senior Frontend Engineer", time_limit_min: 45 } },
};

export const transcriptTurns = (from: number, count: number) => ({
  turns: Array.from({ length: count }, (_, i) => ({
    id: from + i, turn_number: from + i, speaker: (from + i) % 2 ? "ai" : "candidate",
    text: `Turn ${from + i}`, audio_start_ms: null, audio_end_ms: null, created_at: "2026-10-01T09:00:00Z",
  })),
  total: count,
});

// SkillTaxonomiesController#skill_json
const taxonomySkill = (skill_id: string, skill_label: string, category: string) => ({
  skill_id, skill_label, category,
  scope_include: `${skill_label} in production work`, scope_exclude: null,
  l1_anchor: "Needs close guidance.", l2_anchor: "Independent on routine scope.",
  l3_anchor: "Handles ambiguity and trade-offs.", l4_anchor: "Sets standards for the team.",
  l5_anchor: "Shapes practice across the org.",
});

export const skillTaxonomies = {
  skill_taxonomies: [
    taxonomySkill("SK-ENG-001", "React", "engineering"),
    taxonomySkill("SK-ENG-003", "System Design", "engineering"),
    taxonomySkill("SK-SOFT-001", "Communication", "soft_skills"),
  ],
};

// AssessmentsController#assessment_with_skills_json
export const assessmentWithSkills = {
  assessment: {
    ...assessment,
    skills: [
      { id: 11, ...taxonomySkill("SK-ENG-001", "React", "engineering"), is_custom: false, expected_level: 3, display_order: 0 },
      { id: 12, ...taxonomySkill("SK-SOFT-001", "Communication", "soft_skills"), is_custom: false, expected_level: 3, display_order: 1 },
    ].map(({ category: _category, ...s }) => s),
  },
};

// SessionsController#index for one assessment, newest first
export const assessmentSessions = {
  sessions: [
    { ...session, id: 44, candidate_name: "Budi Santoso", status: "pending", end_reason: null, started_at: null, ended_at: null,
      invite_token: "tok-pending", invite_url: "http://localhost:5173/interview/tok-pending" },
    { ...session, id: 43, candidate_name: "Sari Wijaya", status: "active", end_reason: null, ended_at: null },
    { ...session, id: 42, candidate_name: "Test Candidate" },
    { ...session, id: 41, candidate_name: "Dewi Lestari", end_reason: "error" },
  ],
};

// VacanciesController#vacancy_with_skills_json
export const vacancyWithSkills = {
  vacancy: {
    ...vacancies.vacancies[0],
    competency_expectations: "Strong communicator",
    skills: [
      { id: 21, skill_id: null, skill_label: "React", expected_level: 4,
        l1_anchor: null, l2_anchor: null, l3_anchor: null, l4_anchor: null, l5_anchor: null },
      { id: 22, skill_id: null, skill_label: "Communication", expected_level: 3,
        l1_anchor: null, l2_anchor: null, l3_anchor: null, l4_anchor: null, l5_anchor: null },
    ],
  },
};
