const MOCK_ACTIVE_SESSION = {
  id: 14,
  assessment_id: 1,
  tenant_id: 1,
  candidate_id: null,
  candidate_name: "5",
  invite_token: "!nv!t3_t0k3n",
  invite_url: "http://localhost:5173/interview/!nv!t3_t0k3n",
  status: "ended",
  end_reason: "manual_candidate",
  started_at: "2026-08-16T04:08:42.388Z",
  ended_at: "2026-08-16T04:08:54.362Z",
  duration_seconds: 11,
  created_at: "2026-08-16T04:08:31.081Z",
  assessment: {
    id: 1,
    name: "Junior Frontend Engineer",
    time_limit_min: 30,
  },
};

export default MOCK_ACTIVE_SESSION;
