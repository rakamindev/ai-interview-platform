import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "@/services/api";
import { vacanciesApi } from "@/services/vacancies";

vi.mock("@/services/api", () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { vacancies: [], meta: {} } })) },
}));

const getMock = api.get as ReturnType<typeof vi.fn>;

beforeEach(() => {
  getMock.mockClear();
});

describe("vacanciesApi.list", () => {
  it("translates perPage to the backend per_page query parameter", async () => {
    await vacanciesApi.list({ page: 2, perPage: 100 });

    expect(getMock).toHaveBeenCalledWith("/vacancies", {
      params: { page: 2, per_page: 100 },
    });
  });

  it("preserves the default first-page request without an unnecessary per_page value", async () => {
    await vacanciesApi.list();

    expect(getMock).toHaveBeenCalledWith("/vacancies", {
      params: { page: 1 },
    });
  });
});
