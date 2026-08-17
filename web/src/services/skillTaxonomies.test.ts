import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { skillTaxonomiesApi } from "./skillTaxonomies";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/services/api", () => ({ default: apiMock, WS_URL: "ws://test" }));

describe("skillTaxonomiesApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists skill taxonomies", async () => {
    apiMock.get.mockResolvedValue({ data: { skill_taxonomies: [] } });
    await skillTaxonomiesApi.list();
    expect(apiMock.get).toHaveBeenCalledWith("/skill_taxonomies");
  });

  it("fetches a single taxonomy by id", async () => {
    apiMock.get.mockResolvedValue({ data: { skill_taxonomy: { id: "react" } } });
    await skillTaxonomiesApi.get("react");
    expect(apiMock.get).toHaveBeenCalledWith("/skill_taxonomies/react");
  });
});
