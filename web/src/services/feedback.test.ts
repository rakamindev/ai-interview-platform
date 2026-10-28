import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock axios BEFORE importing modules that use axios.create
vi.mock("axios", () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };

  return {
    default: {
      post: vi.fn(),
      get: vi.fn(),
      create: vi.fn(() => mockAxiosInstance),
    },
  };
});

// Mock the internal api instance
vi.mock("./api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import axios from "axios";
import api from "./api";
import { feedbackApi } from "./feedback";

describe("feedbackApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("submit (Candidate endpoint - unauthenticated axios)", () => {
    it("posts feedback payload without JWT authorization headers", async () => {
      const mockFeedbackResponse = {
        data: {
          feedback: {
            id: 1,
            session_id: 10,
            rating: 5,
            experience_tag: "smooth",
            has_complaint: false,
          },
        },
      };

      vi.mocked(axios.post).mockResolvedValueOnce({ data: mockFeedbackResponse });

      const payload = {
        rating: 5,
        experience_tag: "smooth",
        feedback_text: "Great experience",
        has_complaint: false,
      };

      const res = await feedbackApi.submit("token-xyz-123", payload);

      expect(axios.post).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(axios.post).mock.calls[0];
      expect(callArgs[0]).toContain("/sessions/token-xyz-123/feedback");
      expect(callArgs[1]).toEqual({ feedback: payload });
      expect(res.data).toEqual(mockFeedbackResponse);
    });

    it("propagates 422 error when feedback is invalid or already submitted", async () => {
      const errorResponse = {
        response: {
          status: 422,
          data: { message: "Feedback has already been submitted for this session" },
        },
      };

      vi.mocked(axios.post).mockRejectedValueOnce(errorResponse);

      await expect(
        feedbackApi.submit("token-xyz", { rating: 5, has_complaint: false })
      ).rejects.toEqual(errorResponse);
    });

    it("handles complaint payload properly", async () => {
      vi.mocked(axios.post).mockResolvedValueOnce({
        data: { data: { feedback: { id: 2, has_complaint: true } } },
      });

      const payload = {
        rating: 1,
        experience_tag: "technical_issue",
        has_complaint: true,
        complaint_text: "The mic disconnected repeatedly.",
      };

      await feedbackApi.submit("token-xyz", payload);

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/sessions/token-xyz/feedback"),
        { feedback: payload },
        expect.any(Object)
      );
    });
  });

  describe("getBySession (Assessor endpoint - authenticated api instance)", () => {
    it("calls session feedback endpoint using the authenticated api instance", async () => {
      const mockResult = {
        feedback: {
          id: 5,
          session_id: 42,
          rating: 4,
          experience_tag: "smooth",
          has_complaint: false,
        },
      };

      vi.mocked(api.get).mockResolvedValueOnce({ data: mockResult } as any);

      const res = await feedbackApi.getBySession(42);

      expect(api.get).toHaveBeenCalledWith("/sessions/42/feedback");
      expect(res.data).toEqual(mockResult);
    });

    it("handles null feedback when candidate has not submitted yet", async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ data: { feedback: null } } as any);

      const res = await feedbackApi.getBySession(99);
      expect(res.data.feedback).toBeNull();
    });
  });
});
