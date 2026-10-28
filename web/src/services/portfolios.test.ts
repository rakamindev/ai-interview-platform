import { describe, it, expect, vi, beforeEach } from "vitest";

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

import api from "./api";
import { sessionsApi } from "./sessions";
import { portfoliosApi } from "./portfolios";
import type { Portfolio } from "@/types";

describe("sessionsApi - Portfolio endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPortfolio", () => {
    it("handles generating status response", async () => {
      (api.get as any).mockResolvedValue({
        data: { status: "generating" },
      });

      const res = await sessionsApi.getPortfolio(56);
      expect(api.get).toHaveBeenCalledWith("/sessions/56/portfolio");
      expect(res.data).toEqual({ status: "generating" });
    });

    it("handles empty transcript context response", async () => {
      const mockPortfolio: Portfolio = {
        id: 12,
        session_id: 56,
        generation_status: "failed",
        context_status: "empty_transcript",
        context_notes: "Sesi interview tidak memiliki rekaman percakapan atau transkrip kosong.",
        generation_error: "Transkrip interview kosong. Kandidat belum memberikan jawaban yang dapat dinilai.",
        skills: [],
        overrides: [],
      };

      (api.get as any).mockResolvedValue({
        data: { portfolio: mockPortfolio },
      });

      const res = await sessionsApi.getPortfolio(56);
      expect(res.data).toHaveProperty("portfolio");
      const p = (res.data as any).portfolio;
      expect(p.context_status).toBe("empty_transcript");
      expect(p.generation_status).toBe("failed");
      expect(p.context_notes).toContain("rekaman percakapan");
    });

    it("handles out of context evaluation response", async () => {
      const mockPortfolio: Portfolio = {
        id: 15,
        session_id: 57,
        generation_status: "complete",
        context_status: "out_of_context",
        context_notes: "Kandidat hanya menceritakan pengalaman di luar topik teknis.",
        skills: [],
        overrides: [],
      };

      (api.get as any).mockResolvedValue({
        data: { portfolio: mockPortfolio },
      });

      const res = await sessionsApi.getPortfolio(57);
      const p = (res.data as any).portfolio;
      expect(p.context_status).toBe("out_of_context");
      expect(p.generation_status).toBe("complete");
      expect(p.context_notes).toContain("di luar topik teknis");
    });
  });

  describe("regeneratePortfolio", () => {
    it("calls regenerate endpoint", async () => {
      (api.post as any).mockResolvedValue({
        data: {
          message: "Portfolio generation queued",
          portfolio: { id: 12, generation_status: "pending" },
        },
      });

      const res = await sessionsApi.regeneratePortfolio(56);
      expect(api.post).toHaveBeenCalledWith("/sessions/56/portfolio/regenerate");
      expect(res.data.message).toBe("Portfolio generation queued");
    });
  });
});
