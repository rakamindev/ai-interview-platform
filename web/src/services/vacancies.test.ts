import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { vacanciesApi } from "./vacancies";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/services/api", () => ({ default: apiMock, WS_URL: "ws://test" }));

describe("vacanciesApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists vacancies with the page param", async () => {
    apiMock.get.mockResolvedValue({ data: { vacancies: [], meta: { page: 1 } } });
    await vacanciesApi.list(2);
    expect(apiMock.get).toHaveBeenCalledWith("/vacancies", { params: { page: 2 } });
  });

  it("defaults the list page to 1", async () => {
    apiMock.get.mockResolvedValue({ data: { vacancies: [], meta: { page: 1 } } });
    await vacanciesApi.list();
    expect(apiMock.get).toHaveBeenCalledWith("/vacancies", { params: { page: 1 } });
  });

  it("fetches a single vacancy", async () => {
    apiMock.get.mockResolvedValue({ data: { vacancy: { id: 5 } } });
    await vacanciesApi.get(5);
    expect(apiMock.get).toHaveBeenCalledWith("/vacancies/5");
  });

  it("creates a vacancy", async () => {
    apiMock.post.mockResolvedValue({ data: { vacancy: { id: 1 } } });
    const data = {
      role_title: "Engineer",
      culture_dimensions: "c",
      competency_expectations: "e",
      vacancy_skills_attributes: [],
    };
    await vacanciesApi.create(data);
    expect(apiMock.post).toHaveBeenCalledWith("/vacancies", { vacancy: data });
  });

  it("updates a vacancy", async () => {
    apiMock.put.mockResolvedValue({ data: { vacancy: { id: 5 } } });
    const data = {
      role_title: "Senior",
      culture_dimensions: "c",
      competency_expectations: "e",
      vacancy_skills_attributes: [],
    };
    await vacanciesApi.update(5, data);
    expect(apiMock.put).toHaveBeenCalledWith("/vacancies/5", { vacancy: data });
  });

  it("deletes a vacancy", async () => {
    apiMock.delete.mockResolvedValue({ data: {} });
    await vacanciesApi.delete(5);
    expect(apiMock.delete).toHaveBeenCalledWith("/vacancies/5");
  });
});
