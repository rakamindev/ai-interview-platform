import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { assessmentsApi } from "./assessments";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/services/api", () => ({ default: apiMock, WS_URL: "ws://test" }));

describe("assessmentsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists assessments with the page param", async () => {
    apiMock.get.mockResolvedValue({ data: { assessments: [], meta: { page: 1 } } });
    await assessmentsApi.list(3);
    expect(apiMock.get).toHaveBeenCalledWith("/assessments", { params: { page: 3 } });
  });

  it("defaults the list page to 1", async () => {
    apiMock.get.mockResolvedValue({ data: { assessments: [], meta: { page: 1 } } });
    await assessmentsApi.list();
    expect(apiMock.get).toHaveBeenCalledWith("/assessments", { params: { page: 1 } });
  });

  it("fetches a single assessment", async () => {
    apiMock.get.mockResolvedValue({ data: { assessment: { id: 5 } } });
    await assessmentsApi.get(5);
    expect(apiMock.get).toHaveBeenCalledWith("/assessments/5");
  });

  it("creates an assessment with the payload and session flag", async () => {
    apiMock.post.mockResolvedValue({ data: { assessment: { id: 1 } } });
    const data = { name: "Quiz", time_limit_min: 30, assessment_skills_attributes: [] };
    await assessmentsApi.create(data, true);
    expect(apiMock.post).toHaveBeenCalledWith("/assessments", {
      assessment: data,
      create_session: true,
    });
  });

  it("defaults create_session to false", async () => {
    apiMock.post.mockResolvedValue({ data: { assessment: { id: 1 } } });
    const data = { name: "Quiz", time_limit_min: 30, assessment_skills_attributes: [] };
    await assessmentsApi.create(data);
    expect(apiMock.post).toHaveBeenCalledWith("/assessments", {
      assessment: data,
      create_session: false,
    });
  });

  it("updates an assessment", async () => {
    apiMock.put.mockResolvedValue({ data: { assessment: { id: 5 } } });
    const data = { name: "Renamed", time_limit_min: 45, assessment_skills_attributes: [] };
    await assessmentsApi.update(5, data);
    expect(apiMock.put).toHaveBeenCalledWith("/assessments/5", { assessment: data });
  });

  it("deletes an assessment", async () => {
    apiMock.delete.mockResolvedValue({ data: {} });
    await assessmentsApi.delete(5);
    expect(apiMock.delete).toHaveBeenCalledWith("/assessments/5");
  });

  it("fetches the generated system prompt", async () => {
    apiMock.get.mockResolvedValue({ data: { system_prompt: "You are..." } });
    await assessmentsApi.getSystemPrompt(5);
    expect(apiMock.get).toHaveBeenCalledWith("/assessments/5/system_prompt");
  });

  it("lists sessions for an assessment", async () => {
    apiMock.get.mockResolvedValue({ data: { sessions: [] } });
    await assessmentsApi.getSessions(5);
    expect(apiMock.get).toHaveBeenCalledWith("/assessments/5/sessions");
  });

  it("creates a session with candidate details", async () => {
    apiMock.post.mockResolvedValue({ data: { session: { id: 9 }, invite_url: "u" } });
    await assessmentsApi.createSession(5, "Budi", 7);
    expect(apiMock.post).toHaveBeenCalledWith("/assessments/5/sessions", {
      session: { candidate_name: "Budi", candidate_id: 7 },
    });
  });

  it("creates a session without candidate details when omitted", async () => {
    apiMock.post.mockResolvedValue({ data: { session: { id: 9 }, invite_url: "u" } });
    await assessmentsApi.createSession(5);
    expect(apiMock.post).toHaveBeenCalledWith("/assessments/5/sessions", {
      session: { candidate_name: undefined, candidate_id: undefined },
    });
  });
});
