import { describe, it, expect, vi, beforeEach } from "vitest";
import { sessionsApi } from "../sessions";
import api from "../api";

vi.mock("../api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

describe("sessionsApi service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates candidate_name via PATCH /sessions/:id", async () => {
    const mockResponse = {
      data: {
        session: {
          id: 12,
          candidate_name: "Budi Santoso",
          status: "pending",
        },
      },
    };
    (api.patch as any).mockResolvedValueOnce(mockResponse);

    const result = await sessionsApi.update(12, { candidate_name: "Budi Santoso" });

    expect(api.patch).toHaveBeenCalledWith("/sessions/12", {
      session: { candidate_name: "Budi Santoso" },
    });
    expect(result.data.session.candidate_name).toBe("Budi Santoso");
  });

  it("fetches session details via GET /sessions/:id", async () => {
    const mockResponse = {
      data: {
        session: { id: 12, status: "active" },
        assessment: { id: 1, name: "Backend Lead", time_limit_min: 45 },
      },
    };
    (api.get as any).mockResolvedValueOnce(mockResponse);

    const result = await sessionsApi.get(12);

    expect(api.get).toHaveBeenCalledWith("/sessions/12");
    expect(result.data.assessment.name).toBe("Backend Lead");
  });

  it("ends session via POST /sessions/:id/end_session", async () => {
    const mockResponse = {
      data: {
        session: { id: 12, status: "ended", end_reason: "manual_assessor" },
      },
    };
    (api.post as any).mockResolvedValueOnce(mockResponse);

    const result = await sessionsApi.endSession(12, "manual_assessor");

    expect(api.post).toHaveBeenCalledWith("/sessions/12/end_session", {
      session: { reason: "manual_assessor" },
    });
    expect(result.data.session.status).toBe("ended");
  });
});
