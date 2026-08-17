import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { sessionsApi } from "./sessions";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/services/api", () => ({ default: apiMock, WS_URL: "ws://test" }));

describe("sessionsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches a session", async () => {
    apiMock.get.mockResolvedValue({ data: { session: { id: 1 } } });
    await sessionsApi.get(1);
    expect(apiMock.get).toHaveBeenCalledWith("/sessions/1");
  });

  it("lists live sessions", async () => {
    apiMock.get.mockResolvedValue({ data: { sessions: [] } });
    await sessionsApi.live();
    expect(apiMock.get).toHaveBeenCalledWith("/sessions/live");
  });

  it("ends a session with the default reason", async () => {
    apiMock.post.mockResolvedValue({ data: { session: { id: 1 } } });
    await sessionsApi.endSession(1);
    expect(apiMock.post).toHaveBeenCalledWith("/sessions/1/end_session", {
      session: { reason: "manual_assessor" },
    });
  });

  it("ends a session with a custom reason", async () => {
    apiMock.post.mockResolvedValue({ data: { session: { id: 1 } } });
    await sessionsApi.endSession(1, "auto_timeout");
    expect(apiMock.post).toHaveBeenCalledWith("/sessions/1/end_session", {
      session: { reason: "auto_timeout" },
    });
  });

  it("revokes a session", async () => {
    apiMock.post.mockResolvedValue({ data: { session: { id: 1 } } });
    await sessionsApi.revoke(1);
    expect(apiMock.post).toHaveBeenCalledWith("/sessions/1/revoke");
  });

  it("fetches coverage for a session", async () => {
    apiMock.get.mockResolvedValue({ data: { skills: [], discovered: [] } });
    await sessionsApi.getCoverage(1);
    expect(apiMock.get).toHaveBeenCalledWith("/sessions/1/coverage");
  });

  it("fetches a transcript without a from_turn param by default", async () => {
    apiMock.get.mockResolvedValue({ data: { turns: [], total: 0 } });
    await sessionsApi.getTranscript(1);
    expect(apiMock.get).toHaveBeenCalledWith("/sessions/1/transcript", { params: undefined });
  });

  it("fetches a transcript from a specific turn", async () => {
    apiMock.get.mockResolvedValue({ data: { turns: [], total: 0 } });
    await sessionsApi.getTranscript(1, 4);
    expect(apiMock.get).toHaveBeenCalledWith("/sessions/1/transcript", {
      params: { from_turn: 4 },
    });
  });

  it("fetches the portfolio for a session", async () => {
    apiMock.get.mockResolvedValue({ data: { portfolio: { id: 3 } } });
    await sessionsApi.getPortfolio(1);
    expect(apiMock.get).toHaveBeenCalledWith("/sessions/1/portfolio");
  });

  it("regenerates a portfolio", async () => {
    apiMock.post.mockResolvedValue({ data: { message: "ok", portfolio: { id: 3 } } });
    await sessionsApi.regeneratePortfolio(1);
    expect(apiMock.post).toHaveBeenCalledWith("/sessions/1/portfolio/regenerate");
  });

  it("fetches candidate info by invite token", async () => {
    apiMock.get.mockResolvedValue({ data: { name: "Budi" } });
    await sessionsApi.getCandidateInfo("tok123");
    expect(apiMock.get).toHaveBeenCalledWith("/sessions/tok123/candidate");
  });

  it("marks audio complete by invite token", async () => {
    apiMock.post.mockResolvedValue({ data: { ended: true, message: "done" } });
    await sessionsApi.audioComplete("tok123");
    expect(apiMock.post).toHaveBeenCalledWith("/sessions/tok123/audio_complete");
  });
});
