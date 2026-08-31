export const MOCK_EMPTY_TRANSCRIPT = {
  turns: [],
  total: 0,
};

const MOCK_TRANSCRIPT = {
  turns: [
    {
      id: 1,
      turn_number: 1,
      speaker: "ai",
      text: "Hi, thanks for joining me. Let's jump right in – tell me about the most technically challenging project you've worked on recently.",
      audio_start_ms: null,
      audio_end_ms: null,
      created_at: "2026-08-16T04:08:45.650Z",
    },
  ],
  total: 1,
};

export default MOCK_TRANSCRIPT;
