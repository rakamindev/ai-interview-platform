export const MOCK_FAIL_PORTFOLIO = {
  portfolio: {
    id: 12,
    session_id: 14,
    candidate_id: null,
    generation_status: "failed",
    generated_at: null,
    generation_error: "Failed after 3 retries: API returned 404",
    skills: [],
    overrides: [],
  },
  error: "Failed after 3 retries: API returned 404",
};

const MOCK_PORTFOLIO = {
  portfolio: {
    id: 13,
    session_id: 16,
    candidate_id: null,
    generation_status: "complete",
    generated_at: "2026-08-16T07:21:13.608Z",
    generation_error: null,
    skills: [
      {
        id: 2,
        skill_id: "reactjs-dummies",
        skill_label: "ReactJs dummies",
        is_discovered: false,
        ai_level: 2,
        ai_confidence: "low",
        evidence: [
          "That's used when we need to share the set between parent and child. And then props only when we want the set to be read only.",
          "Yeah, basically we can passing the state set from parent into child and in the child we can call the state set to update the parent state.",
          "Some, yeah, if one global state is changed, maybe the entire application will be re-rendered because we did not handle the state correctly.",
        ],
        competency_summary:
          "The candidate understands the fundamental differences between state and props, including how to lift state up and pass updater functions to child components. They are aware of global state management options and the performance risks of unnecessary context re-renders, though they rely on third-party libraries rather than native React patterns to resolve them.",
      },
    ],
    overrides: [],
  },
};

export default MOCK_PORTFOLIO;
