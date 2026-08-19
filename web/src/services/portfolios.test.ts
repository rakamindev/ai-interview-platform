import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { portfoliosApi } from "./portfolios";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/services/api", () => ({ default: apiMock, WS_URL: "ws://test" }));

describe("portfoliosApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts an assessor override for a portfolio skill", async () => {
    apiMock.post.mockResolvedValue({ data: { override: { id: 1 } } });
    const data = { override_level: 3, assessor_notes: "strong" };
    await portfoliosApi.getOverride(7, data);
    expect(apiMock.post).toHaveBeenCalledWith("/portfolio_skills/7/override", { override: data });
  });

  it("triggers a fit/gap report for a portfolio and vacancy", async () => {
    apiMock.post.mockResolvedValue({ data: { report: { id: 1 } } });
    await portfoliosApi.triggerFitGap(1, 9);
    expect(apiMock.post).toHaveBeenCalledWith("/portfolios/1/fitgap", {
      fitgap: { vacancy_id: 9 },
    });
  });

  it("fetches an existing fit/gap report", async () => {
    apiMock.get.mockResolvedValue({ data: { report: { id: 1 } } });
    await portfoliosApi.getFitGap(1, 9);
    expect(apiMock.get).toHaveBeenCalledWith("/portfolios/1/fitgap/9");
  });

  it("regenerates a fit/gap report", async () => {
    apiMock.post.mockResolvedValue({ data: { status: "queued", message: "ok" } });
    await portfoliosApi.regenerateFitGap(1, 9);
    expect(apiMock.post).toHaveBeenCalledWith("/portfolios/1/regenerate_fitgap", {
      vacancy_id: 9,
    });
  });

  it("exports a portfolio as a blob when format is pdf", async () => {
    apiMock.get.mockResolvedValue({ data: new Blob() });
    await portfoliosApi.exportPortfolio(1, "pdf");
    expect(apiMock.get).toHaveBeenCalledWith("/portfolios/1/export", {
      params: { format: "pdf" },
      responseType: "blob",
    });
  });

  it("exports a portfolio as json and includes the vacancy id when given", async () => {
    apiMock.get.mockResolvedValue({ data: {} });
    await portfoliosApi.exportPortfolio(1, "json", 9);
    expect(apiMock.get).toHaveBeenCalledWith("/portfolios/1/export", {
      params: { format: "json", vacancy_id: 9 },
      responseType: "json",
    });
  });

  it("omits the vacancy id from the export params when absent", async () => {
    apiMock.get.mockResolvedValue({ data: {} });
    await portfoliosApi.exportPortfolio(1, "json");
    expect(apiMock.get).toHaveBeenCalledWith("/portfolios/1/export", {
      params: { format: "json" },
      responseType: "json",
    });
  });
});
